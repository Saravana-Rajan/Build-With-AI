/** Formatting helpers shared across screens. */

const CRORE = 1e7; // 1 crore = 10,000,000

/**
 * Format a rupee value (in ₹) as a compact crore headline: "₹5.2 crore".
 * Handles null/undefined/NaN gracefully.
 */
export function formatCrore(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "₹—";
  return `₹${(value / CRORE).toFixed(1)} crore`;
}

/** Plain Indian-grouped rupee amount, e.g. "₹12,50,000". */
export function formatInr(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "₹—";
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}
