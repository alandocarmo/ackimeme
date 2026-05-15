/**
 * Shared utility functions for AckiMeme frontend.
 */

/**
 * Formats a number with Brazilian locale (points for thousands, comma for decimal).
 * Robustly handles strings with existing separators.
 */
export function formatNum(n, decimals = 2) {
  if (n === null || n === undefined || n === "") return "0";
  
  // If it's already a string with dots/commas, we need to be careful.
  // We first try to normalize it to a number.
  let val = n;
  if (typeof n === "string") {
    // Remove formatting if it looks like a formatted number
    // But don't remove the decimal point if it's the only one.
    // Simpler: just use Number() if it's a raw string, or sanitize.
    val = Number(n.replace(/[^\d.-]/g, ''));
  }
  
  if (isNaN(val)) return String(n);

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatSupply(n, isNano = false) {
  let val = typeof n === "string" ? Number(n.replace(/[^\d.-]/g, '')) : Number(n);
  if (!Number.isFinite(val)) return "0";
  if (isNano) val = val / 1e9;
  if (val >= 1e9) return (val / 1e9).toFixed(2) + "B";
  if (val >= 1e6) return (val / 1e6).toFixed(2) + "M";
  if (val >= 1e3) return (val / 1e3).toFixed(2) + "K";
  return val.toFixed(2);
}

export function compactWallet(w) {
  const s = String(w || "");
  return s.length <= 14 ? s : `${s.slice(0, 8)}…${s.slice(-6)}`;
}

export function isSafeUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function formatDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * Returns the label and color for a given slope divisor.
 * Ensures consistency between Creation and Token pages.
 */
export function getSlopeLabel(divisor) {
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
export function sliderToSlopeDivisor(index) {
  const map = {
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
export function slopeDivisorToSlider(divisor) {
  const d = Number(divisor);
  if (d >= 20_000_000_000_000) return 1;
  if (d >= 10_000_000_000_000) return 2;
  if (d >= 5_000_000_000_000)  return 3;
  if (d >= 2_500_000_000_000)  return 4;
  return 5;
}
