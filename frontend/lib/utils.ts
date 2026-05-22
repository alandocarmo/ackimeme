/**
 * Shared utility functions for AckiMeme frontend.
 */

/**
 * Formats a number with Brazilian locale (points for thousands, comma for decimal).
 * Robustly handles strings with existing separators.
 */
export function formatNum(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(/\./g, '').replace(',', '.')) : value;
  if (isNaN(num)) return "0";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatSupply(value: number | string | undefined | null, isNano: boolean = false): string {
  if (value === null || value === undefined || value === "") return "0";
  let val = typeof value === "string" ? Number(value.replace(/[^\d.-]/g, '')) : Number(value);
  if (!Number.isFinite(val)) return "0";
  if (isNano) val = val / 1e9;
  if (val >= 1e9) return (val / 1e9).toFixed(2) + "B";
  if (val >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (val >= 1e3) return (val / 1e3).toFixed(2) + "K";
  return val.toFixed(2);
}

export function compactWallet(w: string | null | undefined): string {
  const s = String(w || "");
  return s.length <= 14 ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}

export function isSafeUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatDate(d: string | number | Date | null | undefined): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Returns the label and color for a given slope divisor.
 * Ensures consistency between Creation and Token pages.
 */
export function getSlopeLabel(divisor: string | number): { label: string; color: string; class: string } {
  // Divisor is stored in Nano (10^9) or raw units.
  // Normal (1x) is ~10T (10,000,000,000,000).
  const d = Number(divisor);
  
  if (d >= 20_000_000_000_000) return { label: "Suave (0.5x)", color: "var(--accent)", class: "suave" };
  if (d >= 10_000_000_000_000) return { label: "Normal (1x)", color: "var(--accent)", class: "normal" };
  if (d >= 5_000_000_000_000)  return { label: "Fast (2x)", color: "var(--accent)", class: "fast" };
  if (d >= 2_500_000_000_000)  return { label: "Aggressive (4x)", color: "var(--accent)", class: "aggressive" };
  return { label: "INSANE (10x)", color: "#FF3B30", class: "insane" };
}

/**
 * Maps the 1-5 slider index to the actual slope divisor value.
 */
export function sliderToSlopeDivisor(index: number): number {
  const map: Record<number, number> = {
    1: 20_000_000_000_000, // 0.5x
    2: 10_000_000_000_000, // 1x
    3: 5_000_000_000_000,  // 2x
    4: 2_500_000_000_000,  // 4x
    5: 1_000_000_000_000,  // 10x
  };
  return map[index] || map[2];
}

/**
 * Maps back from divisor to slider index.
 */
export function slopeDivisorToSlider(divisor: string | number): number {
  const d = Number(divisor);
  if (d >= 20_000_000_000_000) return 1;
  if (d >= 10_000_000_000_000) return 2;
  if (d >= 5_000_000_000_000)  return 3;
  if (d >= 2_500_000_000_000)  return 4;
  return 5;
}

/** Nano to decimal (9 decimals standard in TVM/SHELL) */
export function nanoToDecimal(nano: string | number | bigint | null | undefined): number {
  const val = BigInt(String(nano || "0").replace(/\D/g, "") || "0");
  const whole = val / 1_000_000_000n;
  const frac = val % 1_000_000_000n;
  return Number(`${whole}.${String(frac).padStart(9, "0")}`);
}

/** Helper to convert decimal string to BigInt nano (9 decimals) avoiding float imprecision */
export function toNano(valStr: string | number | null | undefined): bigint {
  if (valStr === null || valStr === undefined || valStr === "") return 0n;
  const num = typeof valStr === "string" ? parseFloat(valStr) : valStr;
  if (!Number.isFinite(num) || num < 0) return 0n;
  // Use toFixed to normalize scientific notation to decimal string
  const fixed = num.toFixed(9);
  const [whole = "0", frac = ""] = fixed.split(".");
  const fracPad = frac.padEnd(9, "0").slice(0, 9);
  return BigInt(whole) * 1_000_000_000n + BigInt(fracPad || "0");
}

/**
 * Calculates the exact buy amount doing a binary search against the bonding curve contract.
 * Extracts this heavy logic from the React view.
 */
export async function calculateExactBuyAmount(
  tradeAmount: string | number,
  currentPrice: string | number,
  slippagePct: number | null | undefined,
  bcContract: any
): Promise<{ expectedNanoTokens: bigint; baseCostNano: bigint }> {
  const rawAmountNano = toNano(tradeAmount);
  // maxBaseCostNano = rawAmountNano * 100 / 101
  const maxBaseCostNano = (rawAmountNano * 100n) / 101n;
  
  let low = 0n;
  let high = rawAmountNano * 100000000n;
  let expectedNanoTokens = 0n;
  let baseCostNano = 0n;

  const currentPriceNano = toNano(String(currentPrice));
  if (currentPriceNano > 0n) {
     const spotEst = (maxBaseCostNano * 1000000000n) / currentPriceNano;
     high = spotEst;
     low = spotEst / 2n;
  }

  for (let i = 0; i < 25; i++) {
      const mid = (low + high) / 2n;
      if (mid === 0n) break;
      
      try {
          const res = await (bcContract as { methods: { calculateBuyAmount: (args: { amount: string }) => { call: () => Promise<{ value0: string }> } } }).methods.calculateBuyAmount({ amount: mid.toString() }).call();
          const cost = BigInt(res.value0);
          
          if (cost <= maxBaseCostNano) {
              expectedNanoTokens = mid;
              baseCostNano = cost;
              low = mid + 1n;
          } else {
              high = mid - 1n;
          }
      } catch (err) {
          high = mid - 1n;
      }
  }

  if (expectedNanoTokens === 0n) return { expectedNanoTokens: 0n, baseCostNano: 0n };

  if (slippagePct !== null && slippagePct !== undefined) {
      expectedNanoTokens = expectedNanoTokens * BigInt(Math.round(100 - slippagePct)) / 100n;
      
      const finalCostResult = await bcContract.methods.getBuyPrice({ tokenAmount: expectedNanoTokens.toString() }).call();
      baseCostNano = BigInt(finalCostResult.value0);
  }

  return { expectedNanoTokens, baseCostNano };
}
