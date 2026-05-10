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
