import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight health probe for Caddy / Docker / uptime monitors.
 *
 * Checks the app can serve a request AND reach Postgres. Deliberately
 * does NOT exercise Stripe or Resend - those are external and
 * fire-and-forget; a provider outage shouldn't flap our container.
 *
 * No auth, no rate limit. Expected hit rate is ~2/min from the
 * Docker healthcheck. robots.ts already disallows /api/.
 *
 * 200 { ok: true, db: "ok" }   healthy
 * 503 { ok: false, db: "down" } Postgres unreachable
 */
export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ ok: true, db: "ok" }, { status: 200 });
  } catch (err) {
    console.error("[health] db ping failed:", err);
    return NextResponse.json({ ok: false, db: "down" }, { status: 503 });
  }
}
