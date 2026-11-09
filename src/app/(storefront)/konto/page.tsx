import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { auth, signOut } from "@/auth";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { fetchCustomerProfile } from "@/lib/customer-auth/profile";
import type { CustomerAddressRow } from "@/lib/customer-auth/addresses";
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

type Order = Awaited<ReturnType<typeof fetchCustomerOrders>>[number];

/**
 * Customer dashboard, rebuilt as a dashboard proper.
 *
 *   1. Hero — cream band with decorative branch SVG. Greeting + member-
 *      since + three stat chips embedded so the hero does double duty.
 *   2. Quick actions — three tiles directing toward common next moves.
 *   3. Letzte Bestellung — spotlight card for the most recent order,
 *      bigger and prettier than the list below.
 *   4. Weitere Bestellungen — compact list of the rest.
 *   5. Adressen — grid of contact-style cards with avatar initials,
 *      full CRUD under the fold via the AddressBook component.
 *   6. Konto einstellen — Profile + Sicherheit, deliberately below the
 *      fold since customers rarely edit these.
 *   7. Datenschutz — minimal footer.
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

  const lastOrder = orders[0] ?? null;
  const restOrders = orders.slice(1);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* ================== 1. HERO ================== */}
      <section className="relative overflow-hidden bg-cream border-b border-mist">
        <DecorativeBranch />
        <div className="relative max-w-5xl mx-auto px-4 lg:px-6 py-14 lg:py-20">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="space-y-3 max-w-2xl">
              <p className="text-[0.68rem] tracking-[0.22em] uppercase text-sage font-medium">
                Mein Konto
              </p>
              <h1 className="font-display font-light italic text-bark text-[clamp(2.2rem,5.5vw,3.4rem)] leading-[1.02]">
                Guten Tag, {firstName}.
              </h1>
              <p className="text-[0.9rem] text-bark/70">
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
                className="inline-flex items-center gap-2 border border-bark/70 text-bark bg-ivory/60 backdrop-blur-sm px-5 py-2 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-bark hover:text-ivory active:translate-y-px transition-all duration-200"
              >
                Abmelden
              </button>
            </form>
          </div>

          {/* Stat chips inside the hero — hero does double duty */}
          <div className="mt-10 flex flex-wrap gap-3">
            <StatChip
              icon={<CartGlyph />}
              label="Bestellungen"
              value={String(orders.length)}
            />
            <StatChip
              icon={<AddressGlyph />}
              label="Adressen"
              value={String(addresses.length)}
            />
            <StatChip
              icon={<CalendarGlyph />}
              label="Mitglied"
              value={memberSince}
            />
          </div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 lg:px-6 py-10 lg:py-14 space-y-14">
        {/* ================== 2. QUICK ACTIONS ================== */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ActionTile
            href="/kategorie/alle-anlaesse"
            title="Blumen bestellen"
            sub="Zum Sortiment"
            primary
          />
          <ActionTile
            href="/bestellung-finden"
            title="Bestellung finden"
            sub="Status mit Nummer + E-Mail"
          />
          <ActionTile
            href="#adressen"
            title="Adresse speichern"
            sub="Für schnelleres Bestellen"
          />
        </section>

        {/* ================== 3. LAST ORDER SPOTLIGHT ================== */}
        {lastOrder && (
          <section className="space-y-5">
            <SectionHeading
              eyebrow="Letzte Bestellung"
              title={`Bestellung ${lastOrder.orderNumber}`}
            />
            <OrderSpotlight order={lastOrder} />
          </section>
        )}

        {/* ================== 4. REST OF ORDERS ================== */}
        {orders.length === 0 ? (
          <section className="space-y-5">
            <SectionHeading eyebrow="Meine Bestellungen" title="Noch nichts da" />
            <EmptyOrders />
          </section>
        ) : restOrders.length > 0 ? (
          <section className="space-y-5">
            <div className="flex items-baseline justify-between gap-3">
              <SectionHeading
                eyebrow="Weitere"
                title={`${restOrders.length} ${restOrders.length === 1 ? "Bestellung" : "Bestellungen"}`}
                compact
              />
            </div>
            <ul className="divide-y divide-mist border-y border-mist">
              {restOrders.map((o) => (
                <li key={o.orderNumber}>
                  <OrderListRow order={o} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ================== 5. ADDRESSES ================== */}
        <section id="adressen" className="space-y-5 scroll-mt-24">
          <SectionHeading
            eyebrow="Adressbuch"
            title="Empfänger für schnelleres Bestellen"
          />
          <AddressesGrid addresses={addresses} />
          <AddressBook addresses={addresses} />
        </section>

        {/* ================== 6. ACCOUNT SETTINGS ================== */}
        <section className="space-y-5">
          <SectionHeading eyebrow="Konto" title="Einstellungen" />
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
        </section>

        {/* ================== 7. DATENSCHUTZ FOOTER ================== */}
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

/* ============================================================
   Building blocks
   ============================================================ */

function SectionHeading({
  eyebrow,
  title,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  compact?: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[0.62rem] tracking-[0.22em] uppercase text-sage font-medium">
        {eyebrow}
      </p>
      <h2
        className={
          compact
            ? "font-display font-light text-bark text-[1.15rem] leading-tight"
            : "font-display font-light text-bark text-[clamp(1.4rem,2.5vw,1.8rem)] leading-[1.15]"
        }
      >
        {title}
      </h2>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-ivory/80 border border-mist pl-3 pr-5 py-2">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-rose/10 text-rose">
        {icon}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[1.05rem] text-bark leading-none tabular-nums">
          {value}
        </span>
        <span className="text-[0.68rem] tracking-[0.12em] uppercase text-sage">
          {label}
        </span>
      </div>
    </div>
  );
}

function ActionTile({
  href,
  title,
  sub,
  primary = false,
}: {
  href: string;
  title: string;
  sub: string;
  primary?: boolean;
}) {
  const base =
    "group relative block rounded-lg border p-5 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden";
  const cls = primary
    ? `${base} bg-bark text-ivory border-bark hover:bg-rose hover:border-rose`
    : `${base} bg-card border-mist hover:border-foreground/30`;
  return (
    <Link href={href} className={cls}>
      <div className="space-y-1">
        <div
          className={`text-[0.68rem] tracking-[0.14em] uppercase font-medium ${
            primary ? "text-ivory/70" : "text-sage"
          }`}
        >
          {sub}
        </div>
        <div
          className={`font-display font-light text-[1.2rem] leading-tight ${
            primary ? "text-ivory" : "text-bark"
          }`}
        >
          {title}
        </div>
      </div>
      <span
        className={`absolute right-5 bottom-5 transition-transform duration-200 group-hover:translate-x-1 ${
          primary ? "text-ivory/80" : "text-rose"
        }`}
      >
        →
      </span>
    </Link>
  );
}

function OrderSpotlight({ order: o }: { order: Order }) {
  const placed = DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
    .setLocale("de-CH")
    .toFormat("ccc d. LLL yyyy");
  const delivery = o.deliveryDate
    ? DateTime.fromISO(o.deliveryDate, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("ccc d. LLL")
    : null;
  return (
    <div className="rounded-xl border border-mist bg-card overflow-hidden">
      <div className="grid md:grid-cols-[1fr_auto] gap-6 p-6 lg:p-8">
        <div className="space-y-4 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-mono tabular-nums text-[0.9rem] text-bark">
              {o.orderNumber}
            </span>
            <span className="text-[0.76rem] text-sage">Bestellt {placed}</span>
          </div>

          <div>
            <p className="text-[0.68rem] tracking-[0.14em] uppercase text-sage font-medium">
              Empfänger
            </p>
            <p className="font-display font-light text-bark text-[1.4rem] leading-tight mt-1">
              {o.recipientName}
            </p>
          </div>

          {delivery && (
            <div className="flex items-center gap-2 text-[0.85rem] text-bark/80">
              <CalendarGlyph />
              <span>Lieferung {delivery}</span>
            </div>
          )}
        </div>

        <div className="flex md:flex-col md:items-end justify-between gap-3">
          <StatusBadge status={o.status} />
          <div className="text-right">
            <div className="font-display font-light text-bark text-[1.6rem] leading-none tabular-nums">
              {formatChf(o.totalGross)}
            </div>
            <div className="text-[0.68rem] tracking-[0.12em] uppercase text-sage mt-1">
              Total
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderListRow({ order: o }: { order: Order }) {
  const placed = DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
    .setLocale("de-CH")
    .toFormat("d. LLL yyyy");
  return (
    <div className="grid grid-cols-[1fr_auto] gap-4 py-3 items-center">
      <div className="min-w-0 flex items-baseline gap-3 flex-wrap">
        <span className="font-mono tabular-nums text-[0.82rem] text-bark">
          {o.orderNumber}
        </span>
        <span className="text-[0.8rem] text-bark/80">
          an <span className="font-medium">{o.recipientName}</span>
        </span>
        <span className="text-[0.74rem] text-sage">{placed}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-medium tabular-nums text-[0.88rem] text-bark">
          {formatChf(o.totalGross)}
        </span>
        <StatusBadge status={o.status} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Order["status"] }) {
  const tone =
    status === "delivered"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : status === "out_for_delivery"
        ? "bg-sky-50 text-sky-700 border-sky-200"
        : status === "ready"
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : status === "in_production"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : status === "delivery_failed"
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : status === "cancelled"
                ? "bg-stone-50 text-stone-500 border-stone-200 line-through"
                : "bg-stone-50 text-stone-700 border-stone-200";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[0.68rem] tracking-[0.08em] uppercase font-medium border rounded-full whitespace-nowrap ${tone}`}
    >
      {statusLabelDe(status)}
    </span>
  );
}

function AddressesGrid({ addresses }: { addresses: CustomerAddressRow[] }) {
  if (addresses.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-mist p-6 text-center">
        <p className="text-[0.88rem] text-bark/70">
          Noch keine gespeicherten Adressen. Fügen Sie unten eine hinzu — sie
          wird bei Ihrer nächsten Bestellung vorausgefüllt.
        </p>
      </div>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {addresses.map((a) => (
        <li key={a.id}>
          <AddressContactCard address={a} />
        </li>
      ))}
    </ul>
  );
}

function AddressContactCard({ address }: { address: CustomerAddressRow }) {
  const initials = initialsFrom(address.recipientName);
  return (
    <div className="rounded-lg border border-mist bg-card p-4 h-full space-y-2">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-rose/10 text-rose font-display font-medium text-sm">
          {initials}
        </span>
        <div className="min-w-0">
          {address.labelDe && (
            <div className="text-[0.62rem] tracking-[0.14em] uppercase text-sage font-medium">
              {address.labelDe}
            </div>
          )}
          <div className="text-[0.92rem] font-medium text-bark truncate">
            {address.recipientName}
          </div>
        </div>
      </div>
      <div className="text-[0.8rem] text-bark/75 leading-snug">
        {address.street}
        <br />
        {address.plz} {address.city}
      </div>
      {address.phone && (
        <div className="text-[0.72rem] text-sage tabular-nums">
          {address.phone}
        </div>
      )}
    </div>
  );
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}

function EmptyOrders() {
  return (
    <div className="rounded-xl border border-dashed border-mist p-10 text-center space-y-4">
      <div
        aria-hidden
        className="mx-auto w-12 h-12 rounded-full bg-rose/10 text-rose flex items-center justify-center"
      >
        <CartGlyph size={20} />
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
      <div className="pt-1">
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

/* ---------- SVG decorations ---------- */

function DecorativeBranch() {
  return (
    <svg
      aria-hidden
      className="absolute -right-10 -top-10 w-72 h-72 text-rose/15 pointer-events-none"
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <path d="M160 20 Q 140 70, 100 90 Q 60 110, 40 160" />
      <path d="M152 36 Q 156 28, 168 30" />
      <path d="M152 36 Q 148 46, 154 56" />
      <path d="M130 62 Q 130 52, 142 50" />
      <path d="M130 62 Q 126 72, 134 82" />
      <path d="M100 90 Q 96 80, 108 76" />
      <path d="M100 90 Q 94 100, 102 112" />
      <path d="M76 108 Q 68 100, 74 90" />
      <path d="M76 108 Q 70 120, 78 130" />
      <path d="M52 140 Q 42 136, 44 124" />
      <path d="M52 140 Q 46 152, 54 162" />
      <ellipse cx="170" cy="22" rx="4" ry="2.4" transform="rotate(30 170 22)" />
      <ellipse cx="156" cy="56" rx="4" ry="2.4" transform="rotate(-20 156 56)" />
      <ellipse cx="142" cy="50" rx="4" ry="2.4" transform="rotate(20 142 50)" />
      <ellipse cx="108" cy="76" rx="4" ry="2.4" transform="rotate(20 108 76)" />
      <ellipse cx="102" cy="112" rx="4" ry="2.4" transform="rotate(-25 102 112)" />
      <ellipse cx="78" cy="130" rx="4" ry="2.4" transform="rotate(-10 78 130)" />
      <ellipse cx="54" cy="162" rx="4" ry="2.4" transform="rotate(-15 54 162)" />
    </svg>
  );
}

function CartGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" x2="21" y1="6" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function AddressGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CalendarGlyph() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
