import "server-only";

/**
 * Resolve the tax rate for the delivery fee on a mixed-rate order.
 *
 * INTERIM RULE (until the Treuhänder confirms):
 *   The delivery fee is taxed at the rate of the line group with the
 *   largest gross value. Ties are broken by preferring the HIGHER rate
 *   - conservative for reporting.
 *
 * This function is the ONE place to change if the rule turns out to be
 * "always standard" or "split proportionally" or anything else. Every
 * caller in the reserve transaction goes through here.
 *
 * TODO(Treuhänder): confirm the interim rule and either simplify to a
 * constant here, or split the delivery fee proportionally across lines
 * (which the schema does NOT currently model - order.delivery_fee_tax_rate
 * is a single value).
 */
export function resolveDeliveryTaxRate(
  lines: Array<{ taxRate: string | null; lineTotalGross: string }>,
): string | null {
  const buckets = new Map<string, number>();
  for (const l of lines) {
    if (l.taxRate == null) continue;
    const gross = Number(l.lineTotalGross);
    if (!Number.isFinite(gross) || gross <= 0) continue;
    buckets.set(l.taxRate, (buckets.get(l.taxRate) ?? 0) + gross);
  }
  if (buckets.size === 0) return null;

  // Sort by (sum desc, rate desc) so the tie-break is independent of
  // Map insertion order. Previous iteration-order approach only ran the
  // tie-break branch when the tie was seen AFTER an existing bestRate,
  // which meant lines[] order could decide the winner on exactly-equal
  // sums. Rappen-level impact but deterministic now either way.
  const ranked = Array.from(buckets.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return Number(b[0]) - Number(a[0]);
  });
  return ranked[0][0];
}
