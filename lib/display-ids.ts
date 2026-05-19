/** Human-facing incremental IDs (trail / supply display). */

export function formatTrailId(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `L${String(Math.floor(n)).padStart(5, "0")}`;
}

export function formatSupplyDisplayId(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `S${String(Math.floor(n)).padStart(5, "0")}`;
}

/** Match "42", "00042", "L42", "L00042" → trail_number 42 */
export function parseTrailSearchToken(q: string): number | null {
  const s = q.trim().toUpperCase().replace(/^L/, "");
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/** Match "4", "S00004" → supply_number 4 */
export function parseSupplySearchToken(q: string): number | null {
  const s = q.trim().toUpperCase().replace(/^S/, "");
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}
