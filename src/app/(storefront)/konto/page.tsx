import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { auth, signOut } from "@/auth";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { fetchCustomerProfile } from "@/lib/customer-auth/profile";
import { formatChf } from "@/lib/money";
import { statusLabelDe } from "@/lib/admin/heute";
import { ProfileCard } from "./_components/profile-card";
import { PasswordChangeCard } from "./_components/password-change-card";
import { AddressBook } from "./_components/address-book";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mein Konto",
  robots: { index: false, follow: false },
};

/**
 * Customer dashboard. Composed as a single long page with strong
 * visual hierarchy:
 *
 *   1. Warm greeting hero (cream background, personalisation)
 *   2. Three-up stat strip — orders, addresses, member since
 *   3. Recent orders (the thing customers come back for most)
 *   4. Two-column: Profil | Adressen
 *   5. Sicherheit (collapsed by default — rarely used)
 *   6. Datenschutz footer
 *
 * No tabs, no modals, no client-side navigation — rare visitors
 * benefit from seeing everything at a glance.
 */
export default async function KontoPage() {
  const session = await auth();
  if (
    !session?.user ||
    session.user.role !== "customer" ||
    !session.user.customerId
  ) {
    redirect("/konto/anmelden?callbackUrl=/konto");
  }

  const customerId = session.user.customerId;

  const [profile, orders, addresses] = await Promise.all([
    fetchCustomerProfile(customerId),
    fetchCustomerOrders(customerId),
    fetchCustomerAddresses(customerId),
  ]);

  if (!profile) redirect("/konto/anmelden");

  const firstName = profile.firstName || profile.email.split("@")[0];
  const memberSince = DateTime.fromJSDate(profile.createdAt, {
    zone: "Europe/Zurich",
  })
    .setLocale("de-CH")
    .toFormat("LLLL yyyy");

  const latestOrderDate = orders[0]
    ? DateTime.fromJSDate(orders[0].placedAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("d. LLL yyyy")
    : null;
  const recentOrders = orders.slice(0, 3);
  const hasMoreOrders = orders.length > recentOrders.length;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* -------- 1. Greeting hero -------- */}
      <section className="bg-cream border-b border-mist">
        <div className="max-w-4xl mx-auto px-4 lg:px-6 py-12 lg:py-16">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-2">
              <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
                Mein Konto
              </p>
              <h1 className="font-display font-light text-bark text-[clamp(2rem,5vw,3rem)] leading-[1.05]">
                Guten Tag, {firstName}.
              </h1>
              <p className="text-[0.88rem] text-bark/70">
                {profile.email}
                <span className="mx-2 text-sage/50">·</span>
                <span className="text-sage">Mitglied seit {memberSince}</span>
              </p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="inline-flex items-center gap-2 border border-bark/70 text-bark px-5 py-2 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory active:translate-y-px transition-all duration-200"
              >
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 lg:px-6 py-10 lg:py-12 space-y-12">
        {/* -------- 2. Stat strip -------- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            label="Bestellungen"
            value={String(orders.length)}
            sub={latestOrderDate ? `Zuletzt ${latestOrderDate}` : "Noch keine"}
          />
          <StatCard
            label="Gespeicherte Adressen"
            value={String(addresses.length)}
            sub={
              addresses.length === 0
                ? "Legen Sie eine an"
                : addresses.length === 1
                  ? "1 Empfänger"
                  : `${addresses.length} Empfänger`
            }
          />
          <StatCard
            label="Mitglied seit"
            value={memberSince}
            sub="danke für Ihr Vertrauen"
            displayValue
          />
        </div>

        {/* -------- 3. Recent orders — THE primary content -------- */}
        <section className="space-y-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display font-light text-bark text-[clamp(1.4rem,2.5vw,1.8rem)] leading-tight">
              Meine Bestellungen
            </h2>
            {hasMoreOrders && (
              <span className="text-[0.75rem] text-sage">
                zuletzt {recentOrders.length} von {orders.length}
              </span>
            )}
          </div>

          {orders.length === 0 ? (
            <EmptyOrders />
          ) : (
            <ul className="space-y-2">
              {recentOrders.map((o) => (
                <li key={o.orderNumber}>
                  <OrderRow order={o} />
                </li>
              ))}
            </ul>
          )}

          {orders.length > 0 && (
            <div className="pt-1">
              <Link
                href="/kategorie/alle-anlaesse"
                className="group inline-flex items-center gap-2 text-[0.78rem] text-rose hover:underline font-medium"
              >
                Neue Bestellung aufgeben
                <span className="transition-transform duration-200 group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </div>
          )}
        </section>

        {/* -------- 4. Profil + Adressen two-column -------- */}
        <section className="space-y-5">
          <h2 className="font-display font-light text-bark text-[clamp(1.4rem,2.5vw,1.8rem)] leading-tight">
            Persönliche Daten
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            <ProfileCard
              initial={{
                firstName: profile.firstName,
                lastName: profile.lastName,
                email: profile.email,
                phone: profile.phone,
              }}
            />
            <PasswordChangeCard />
          </div>
          <AddressBook addresses={addresses} />
        </section>

        {/* -------- 5. Datenschutz footer -------- */}
        <section className="pt-6 border-t border-mist space-y-2">
          <h2 className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
            Datenschutz
          </h2>
          <p className="text-[0.82rem] text-bark/70 leading-[1.65] max-w-2xl">
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
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  displayValue,
}: {
  label: string;
  value: string;
  sub: string;
  displayValue?: boolean;
}) {
  return (
    <div className="rounded-lg border border-mist bg-card p-5 space-y-1">
      <div className="text-[0.62rem] tracking-[0.18em] uppercase text-sage font-medium">
        {label}
      </div>
      <div
        className={
          displayValue
            ? "font-display font-light text-bark text-[1.4rem] leading-tight pt-1"
            : "font-display font-light text-bark text-[2rem] leading-none tabular-nums pt-1"
        }
      >
        {value}
      </div>
      <div className="text-[0.75rem] text-sage">{sub}</div>
    </div>
  );
}

function EmptyOrders() {
  return (
    <div className="rounded-lg border border-dashed border-mist p-10 text-center space-y-3">
      <div
        aria-hidden
        className="mx-auto w-10 h-10 rounded-full bg-rose/10 text-rose flex items-center justify-center"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
          <line x1="3" x2="21" y1="6" y2="6" />
          <path d="M16 10a4 4 0 0 1-8 0" />
        </svg>
      </div>
      <p className="text-[0.95rem] text-bark">
        Noch keine Bestellungen auf diesem Konto.
      </p>
      <p className="text-[0.78rem] text-sage max-w-md mx-auto">
        Als Gast bestellt?{" "}
        <Link href="/bestellung-finden" className="text-rose hover:underline">
          Bestellung finden
        </Link>
        .
      </p>
      <div className="pt-2">
        <Link
          href="/kategorie/alle-anlaesse"
          className="group inline-flex items-center gap-2 bg-bark text-ivory px-6 py-2.5 text-[0.72rem] tracking-[0.14em] uppercase font-medium hover:bg-rose active:translate-y-px transition-all duration-200"
        >
          Zum Sortiment
          <span className="transition-transform duration-200 group-hover:translate-x-1">
            →
          </span>
        </Link>
      </div>
    </div>
  );
}

function OrderRow({
  order,
}: {
  order: {
    orderNumber: string;
    placedAt: Date;
    status: Parameters<typeof statusLabelDe>[0];
    recipientName: string;
    totalGross: string;
    deliveryDate: string | null;
  };
}) {
  return (
    <div className="group rounded-md border border-mist bg-card p-4 hover:border-foreground/30 hover:-translate-y-0.5 transition-all duration-200">
      <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
        <div className="min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono tabular-nums text-[0.85rem] text-bark">
              {order.orderNumber}
            </span>
            <span className="text-[0.74rem] text-sage">
              {DateTime.fromJSDate(order.placedAt, { zone: "Europe/Zurich" })
                .setLocale("de-CH")
                .toFormat("d. LLL yyyy")}
            </span>
          </div>
          <div className="text-[0.88rem] text-bark/90 mt-1">
            An: <span className="font-medium">{order.recipientName}</span>
          </div>
          {order.deliveryDate && (
            <div className="text-[0.74rem] text-sage mt-0.5">
              Lieferung{" "}
              {DateTime.fromISO(order.deliveryDate, { zone: "Europe/Zurich" })
                .setLocale("de-CH")
                .toFormat("ccc d. LLL")}
            </div>
          )}
        </div>
        <div className="text-right space-y-1">
          <div className="font-medium tabular-nums text-[0.95rem] text-bark">
            {formatChf(order.totalGross)}
          </div>
          <div className="text-[0.68rem] tracking-[0.08em] uppercase text-sage font-medium">
            {statusLabelDe(order.status)}
          </div>
        </div>
      </div>
    </div>
  );
}
