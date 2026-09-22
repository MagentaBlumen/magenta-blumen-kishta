/**
 * CHF money helpers.
 *
 * Postgres numeric(10,2) returns a STRING in JS. Doing arithmetic on
 * that string is the trap CLAUDE.md rule 4 warns about:
 *   "78.00" - "12.00" = 66      (JS coerces to number, OK)
 *   "78.00" + "12.00" = "78.0012.00"   (string concat, silently broken)
 *
 * So: never inline `Number(...)` on a numeric string away from here.
 * All money handling goes through these helpers.
 *
 * Format is Swiss: "CHF 35.00". We render with two decimals always
 * (even for round numbers) because it looks more like a real price
 * and less like a placeholder.
 */

/** Parse a numeric-string from Postgres into a JS number, or null if invalid. */
export function parseNumeric(input: string | null | undefined): number | null {
  if (input == null || input === "") return null;
  const n = Number(input);
  return Number.isFinite(n) ? n : null;
}

/** "35.00" -> "CHF 35.00". Null / invalid -> "-". */
export function formatChf(input: string | null | undefined): string {
  const n = parseNumeric(input);
  if (n == null) return "—";
  return `CHF ${n.toFixed(2)}`;
}

/** For product cards where multiple variants exist: "ab CHF 35.00". */
export function formatChfFrom(input: string | null | undefined): string {
  const n = parseNumeric(input);
  if (n == null) return "—";
  return `ab CHF ${n.toFixed(2)}`;
}

/**
 * Pick the smallest price among a list of numeric strings.
 * Ignores nulls / invalid values. Returns null if the list is empty
 * or has no valid entries.
 */
export function minPrice(prices: (string | null | undefined)[]): string | null {
  let best: number | null = null;
  for (const p of prices) {
    const n = parseNumeric(p);
    if (n == null) continue;
    if (best == null || n < best) best = n;
  }
  return best == null ? null : best.toFixed(2);
}
