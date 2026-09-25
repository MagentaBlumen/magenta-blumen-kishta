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

  let bestRate: string | null = null;
  let bestSum = -Infinity;
  for (const [rate, sum] of buckets) {
    if (sum > bestSum) {
      bestRate = rate;
      bestSum = sum;
      continue;
    }
    if (sum === bestSum && bestRate !== null) {
      // Tie: pick the higher rate.
      if (Number(rate) > Number(bestRate)) {
        bestRate = rate;
      }
    }
  }
  return bestRate;
}
