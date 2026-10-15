import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { deliveryRun } from "@/db/schema/delivery";
import { order } from "@/db/schema/order";
import { todayZ } from "@/lib/checkout/time";

/**
 * Read-only snapshot for the system-health card on /admin/einstellungen.
 *
 * One query per block, all cheap at florist scale. Deliberately NOT
 * cached - this screen is the only place these numbers appear and
 * freshness matters more than micro-latency.
 */

export type SystemHealth = {
  runs: {
    latestRunDate: string | null;
    daysAhead: number;
    openRunsNext7Days: number;
  };
  orders: {
    latestOrderPlacedAt: Date | null;
    lastHourCount: number;
    totalCount: number;
  };
  integrations: {
    stripe: boolean;
    stripeWebhook: boolean;
    resend: boolean;
    sentry: boolean;
    siteUrl: boolean;
  };
};

export async function fetchSystemHealth(): Promise<SystemHealth> {
  const today = todayZ();
  const todayIso = today.toISODate() ?? "";
  const sevenAhead = today.plus({ days: 7 }).toISODate() ?? "";
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [latestRunRow, openRunsRow, latestOrderRow, lastHourRow, totalRow] =
    await Promise.all([
      db
        .select({ runDate: sql<string>`max(${deliveryRun.runDate})` })
        .from(deliveryRun),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(deliveryRun)
        .where(
          and(
            gte(deliveryRun.runDate, todayIso),
            sql`${deliveryRun.runDate} <= ${sevenAhead}`,
            eq(deliveryRun.isClosed, false),
          ),
        ),
      db
        .select({ placedAt: sql<Date>`max(${order.placedAt})` })
        .from(order),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(order)
        .where(gte(order.placedAt, oneHourAgo)),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(order),
    ]);

  const latestRunDate = latestRunRow[0]?.runDate ?? null;
  const daysAhead = latestRunDate
    ? Math.max(0, Math.floor(
        (new Date(latestRunDate + "T00:00:00Z").getTime() -
          new Date(todayIso + "T00:00:00Z").getTime()) / 86400000,
      ))
    : 0;

  return {
    runs: {
      latestRunDate,
      daysAhead,
      openRunsNext7Days: openRunsRow[0]?.count ?? 0,
    },
    orders: {
      latestOrderPlacedAt: latestOrderRow[0]?.placedAt ?? null,
      lastHourCount: lastHourRow[0]?.count ?? 0,
      totalCount: totalRow[0]?.count ?? 0,
    },
    integrations: {
      stripe: Boolean(process.env.STRIPE_SECRET_KEY),
      stripeWebhook: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
      resend:
        Boolean(process.env.RESEND_API_KEY) &&
        Boolean(process.env.RESEND_FROM_ADDRESS),
      sentry: Boolean(
        process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN,
      ),
      siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    },
  };
}
