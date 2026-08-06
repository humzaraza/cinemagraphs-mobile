// Compact relative timestamp for review rows, comments, and the activity
// feed. Extracted from the film and review detail screens, which had
// drifted: this is the clamped variant.
export function timeAgo(dateStr: string): string {
  // Clamped at zero: a just-posted item carries the server's clock, and
  // a device running behind it would otherwise render "-1m ago".
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
