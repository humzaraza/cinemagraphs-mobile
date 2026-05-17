/**
 * Format a numeric score for display. Always renders with exactly one
 * decimal place so the UI never shows integer-only scores (e.g. "9"
 * instead of "9.0"), which would visually jump as users browse films.
 *
 * Mobile-only utility. Web has its own inline formatting; a shared
 * package would be a follow-up.
 */
export function formatScore(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1);
}
