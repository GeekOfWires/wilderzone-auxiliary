/**
 * Backend timestamps are SQLite datetime('now') strings: "YYYY-MM-DD HH:MM:SS" in UTC.
 * Parse them as UTC and render in the user's local timezone.
 */
export function formatTs(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}
