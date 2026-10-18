import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { auth, signOut } from "@/auth";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { formatChf } from "@/lib/money";
import { statusLabelDe } from "@/lib/admin/heute";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mein Konto",
  robots: { index: false, follow: false },
};

/**
 * Customer-facing dashboard. Shows:
 *   - profile card (name + email)
 *   - orders list (filtered to customer_id = me)
 *   - sign-out button
 *
 * No profile edit UI yet; low priority. Password reset is phone-based
 * (call the shop). Address book is deferred to Phase 2.
 */
export default async function KontoPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "customer" || !session.user.customerId) {
    redirect("/konto/anmelden?callbackUrl=/konto");
  }

  const orders = await fetchCustomerOrders(session.user.customerId);

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-12 lg:py-16 space-y-10 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
            Mein Konto
          </p>
          <h1 className="font-display font-light text-bark text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1]">
            {session.user.name ?? "Willkommen"}
          </h1>
          <p className="text-[0.85rem] text-bark/70">{session.user.email}</p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="inline-block border border-bark text-bark px-5 py-2 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory active:translate-y-px transition-all duration-200"
          >
            Abmelden
          </button>
        </form>
      </header>

      <section className="space-y-3">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Meine Bestellungen
        </h2>
        {orders.length === 0 ? (
          <div className="border border-dashed border-mist p-8 text-center space-y-3">
            <p className="text-[0.9rem] text-bark/75">
              Noch keine Bestellungen auf diesem Konto.
            </p>
            <p className="text-[0.78rem] text-sage">
              Bestellungen, die Sie als Gast aufgegeben haben, erscheinen hier
              nicht. Sie können diese jederzeit unter{" "}
              <Link
                href="/bestellung-finden"
                className="text-rose hover:underline"
              >
                Bestellung finden
              </Link>{" "}
              abrufen.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-mist border-y border-mist">
            {orders.map((o) => (
              <li
                key={o.orderNumber}
                className="grid grid-cols-[1fr_auto] gap-4 py-4 items-start"
              >
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <span className="font-mono tabular-nums text-[0.85rem] text-bark">
                      {o.orderNumber}
                    </span>
                    <span className="text-[0.78rem] text-sage">
                      {DateTime.fromJSDate(o.placedAt, {
                        zone: "Europe/Zurich",
                      })
                        .setLocale("de-CH")
                        .toFormat("d. LLL yyyy")}
                    </span>
                  </div>
                  <div className="text-[0.85rem] text-bark/85 mt-1">
                    An: {o.recipientName}
                  </div>
                  {o.deliveryDate && (
                    <div className="text-[0.78rem] text-sage mt-0.5">
                      Lieferung{" "}
                      {DateTime.fromISO(o.deliveryDate, {
                        zone: "Europe/Zurich",
                      })
                        .setLocale("de-CH")
                        .toFormat("ccc d. LLL")}
                    </div>
                  )}
                </div>
                <div className="text-right space-y-1">
                  <div className="font-medium tabular-nums text-[0.9rem] text-bark">
                    {formatChf(o.totalGross)}
                  </div>
                  <div className="text-[0.72rem] text-sage">
                    {statusLabelDe(o.status)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2 pt-4 border-t border-mist">
        <h2 className="text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium">
          Datenschutz
        </h2>
        <p className="text-[0.82rem] text-bark/70 leading-[1.65]">
          Zur Anonymisierung Ihrer personenbezogenen Daten gemäss revidiertem
          Schweizer DSG schreiben Sie uns an{" "}
          <a
            href="mailto:info@magenta-blumen.ch"
            className="text-rose hover:underline"
          >
            info@magenta-blumen.ch
          </a>
          . Die Bestelldaten mit Rechnungscharakter bleiben aus
          Aufbewahrungsgründen erhalten.
        </p>
      </section>
    </div>
  );
}
