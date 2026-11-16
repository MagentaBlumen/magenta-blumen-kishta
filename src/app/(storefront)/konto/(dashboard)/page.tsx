import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { fetchCustomerProfile } from "@/lib/customer-auth/profile";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { getSuggestedAddressFromLastOrder } from "@/lib/customer-auth/suggested-address";
import { formatChf } from "@/lib/money";
import { thumbUrl } from "@/lib/image-urls";
import type { CustomerProfile } from "@/lib/customer-auth/profile";
import type { CustomerOrderRow } from "@/lib/customer-auth/orders";
import type { CustomerAddressRow } from "@/lib/customer-auth/addresses";
import type { SuggestedAddress } from "@/lib/customer-auth/suggested-address";

export default async function KontoOverview() {
  const session = await auth();
  if (!session?.user?.customerId || session.user.role !== "customer") {
    redirect("/konto/anmelden?callbackUrl=/konto");
  }
  const customerId = session.user.customerId;

  const [profile, orders, addresses] = await Promise.all([
    fetchCustomerProfile(customerId),
    fetchCustomerOrders(customerId),
    fetchCustomerAddresses(customerId),
  ]);
  if (!profile) redirect("/konto/anmelden");

  const suggestion = await getSuggestedAddressFromLastOrder(
    customerId,
    addresses,
  );
  const firstName = profile.firstName || profile.email.split("@")[0];
  const lastOrder = orders[0] ?? null;
  const flowerStripOrders = orders.slice(0, 4);
  const initials = initialsFrom(
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
      profile.email,
  );
  const activeOrderCount = orders.filter(
    (o) => o.status !== "cancelled",
  ).length;

  return (
    <section className="flex flex-col gap-7 lg:gap-10 lg:max-w-[920px]">
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
            Mein Konto
          </p>
          <h1 className="m-0 font-display font-light text-bark text-[clamp(28px,3.2vw,40px)] leading-[1.05]">
            Hallo,{" "}
            <em className="italic text-rose">{firstName}</em>
          </h1>
          <GreetingMeta
            profile={profile}
            orderCount={activeOrderCount}
          />
        </div>
        <Link
          href="/konto/einstellungen"
          aria-label="Profil"
          className="lg:hidden w-12 h-12 grid place-items-center bg-cream text-bark font-display text-[18px] shrink-0 hover:bg-mist transition-colors"
        >
          {initials}
        </Link>
      </header>

      {lastOrder && <HeroOrder order={lastOrder} />}

      {flowerStripOrders.length > 0 && (
        <FlowerStrip orders={flowerStripOrders} />
      )}

      <RecipientsStrip
        addresses={addresses.slice(0, 4)}
        suggestion={suggestion}
      />
    </section>
  );
}

function GreetingMeta({
  profile,
  orderCount,
}: {
  profile: CustomerProfile;
  orderCount: number;
}) {
  const memberSince = DateTime.fromJSDate(profile.createdAt, {
    zone: "Europe/Zurich",
  })
    .setLocale("de-CH")
    .toFormat("LLLL yyyy");
  const orderText =
    orderCount === 0
      ? "Noch keine Bestellungen"
      : orderCount === 1
        ? "1 Bestellung"
        : `${orderCount} Bestellungen`;
  return (
    <p className="m-0 text-[13px] text-sage">
      {orderText} · Mitglied seit {memberSince}
    </p>
  );
}

// ---------- Hero: current/last order with photo + status pill ----------

function HeroOrder({ order: o }: { order: CustomerOrderRow }) {
  const delivered = o.status === "delivered";
  const cancelled = o.status === "cancelled";

  const when = o.deliveryDate
    ? DateTime.fromISO(o.deliveryDate, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("cccc, d. LLLL")
    : DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("cccc, d. LLLL");

  const statusText = delivered
    ? "Geliefert"
    : cancelled
      ? "Storniert"
      : o.status === "out_for_delivery"
        ? "Unterwegs"
        : "Bestellt";

  const titleLine = cancelled
    ? `Bestellung ${o.orderNumber}`
    : `Für ${o.recipientName}`;

  return (
    <article className="border lg:border border-mist bg-white -mx-4 lg:mx-0">
      {/* Photo + overlay. Mobile: 5/4 near-square. Desktop: 16/7
          landscape slab per the mockup. The img is absolutely
          positioned so its natural dimensions can't push the card's
          height past the aspect box; the overlay stays visible at
          the bottom. */}
      <div className="relative aspect-[5/4] sm:aspect-[16/7] bg-cream overflow-hidden">
        {o.firstLineImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(o.firstLineImageUrl)}
            alt=""
            className="absolute top-0 left-0 w-full h-full object-cover block"
          />
        ) : null}
        <div
          className="absolute inset-x-0 bottom-0 p-6 pt-16 text-ivory flex flex-col items-start gap-1.5"
          style={{
            background:
              "linear-gradient(to top, rgba(30,20,12,0.85), rgba(30,20,12,0))",
          }}
        >
          <span
            className={`inline-flex items-center gap-2 h-[30px] px-3 bg-white text-bark text-[14px] font-semibold ${
              cancelled ? "text-stone-500" : ""
            }`}
          >
            <span
              aria-hidden
              className={`w-2 h-2 rounded-full ${
                delivered
                  ? "bg-[#2F6B3E]"
                  : cancelled
                    ? "bg-stone-400"
                    : "bg-[#2E6DB4]"
              }`}
            />
            {statusText}
          </span>
          <h2 className="m-0 font-display font-normal text-[26px] sm:text-[30px] leading-[1.15] text-ivory">
            {titleLine}
          </h2>
          <p className="m-0 text-[15px] text-[#F2E8DC]">{when}</p>
        </div>
      </div>

      <div className="px-5 lg:px-6 py-5 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[15px]">
          <span className="text-sage">
            {o.firstLineProductName ?? `Bestellung ${o.orderNumber}`}
            {o.firstLineVariantLabel ? ` · ${o.firstLineVariantLabel}` : ""}
          </span>
          <strong className="font-semibold tabular-nums text-bark">
            {formatChf(o.totalGross)}
          </strong>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Link
            href={`/bestellung-finden/${o.orderNumber}`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center h-12 px-5 border border-bark text-bark text-[14px] font-semibold hover:bg-cream transition-colors"
          >
            Details
          </Link>
          {/* Reorder-to-cart doesn't exist yet; link to the catalogue. */}
          <Link
            href="/kategorie/alle-anlaesse"
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 h-12 px-5 bg-rose text-ivory text-[14px] font-semibold hover:brightness-110 transition-[filter]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M3 12a9 9 0 1 0 3-6.7" />
              <path d="M3 4v5h5" />
            </svg>
            Nochmals bestellen
          </Link>
        </div>
      </div>
    </article>
  );
}

// ---------- "Ihre Blumen" strip: last orders as photo tiles ----------

function FlowerStrip({ orders }: { orders: CustomerOrderRow[] }) {
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-display font-normal text-[22px] lg:text-[26px] text-bark leading-[1.2]">
          Ihre Blumen
        </h2>
        <Link
          href="/konto/bestellungen"
          className="inline-flex items-center gap-1.5 min-h-11 text-[15px] font-semibold text-rose hover:brightness-90"
        >
          Alle
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <ul
        // Mobile: horizontal scroll strip with snap. Desktop: 4-col grid.
        className={[
          "list-none m-0 p-0",
          "flex gap-3 overflow-x-auto snap-x snap-mandatory",
          "-mx-4 px-4 lg:mx-0 lg:px-0",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          "lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:overflow-visible lg:gap-5",
        ].join(" ")}
      >
        {orders.map((o) => (
          <li
            key={o.orderNumber}
            className="shrink-0 w-[148px] lg:w-auto snap-start"
          >
            <Link
              href={`/bestellung-finden/${o.orderNumber}`}
              className="flex flex-col gap-2 text-bark hover:text-rose transition-colors"
            >
              {o.firstLineImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbUrl(o.firstLineImageUrl)}
                  alt=""
                  className="w-full aspect-square object-cover bg-cream block"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-square bg-cream" />
              )}
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold leading-tight">
                  Für {o.recipientName}
                </span>
                <span className="text-[13px] text-sage">
                  {formatDateShort(o.deliveryDate ?? null, o.placedAt)}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatDateShort(iso: string | null, fallback: Date): string {
  const dt = iso
    ? DateTime.fromISO(iso, { zone: "Europe/Zurich" })
    : DateTime.fromJSDate(fallback, { zone: "Europe/Zurich" });
  return dt.setLocale("de-CH").toFormat("d. LLLL");
}

// ---------- "Ihre Empfänger" strip: avatars + suggestion + new ----------

function RecipientsStrip({
  addresses,
  suggestion,
}: {
  addresses: CustomerAddressRow[];
  suggestion: SuggestedAddress | null;
}) {
  const hasAny = addresses.length > 0 || suggestion != null;
  return (
    <section className="flex flex-col gap-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 font-display font-normal text-[22px] lg:text-[26px] text-bark leading-[1.2]">
          Ihre Empfänger
        </h2>
        <Link
          href="/konto/adressen"
          className="inline-flex items-center gap-1.5 min-h-11 text-[15px] font-semibold text-rose hover:brightness-90"
        >
          Alle
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
      </div>
      <ul
        className={[
          "list-none m-0 p-0",
          "flex gap-3 overflow-x-auto snap-x snap-mandatory",
          "-mx-4 px-4 lg:mx-0 lg:px-0",
          "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
          "lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:overflow-visible lg:gap-5",
        ].join(" ")}
      >
        {suggestion && (
          <li className="shrink-0 w-[148px] lg:w-auto snap-start">
            <Link
              href="/konto/adressen"
              className="min-h-[190px] h-full p-4 border border-dashed border-rose bg-[#FDF2F6]/40 flex flex-col items-center text-center gap-1 text-bark hover:brightness-95"
            >
              <span
                aria-hidden
                className="w-14 h-14 grid place-items-center bg-[#FBE8F1] text-rose font-display text-[20px] mb-1.5"
              >
                {initialsFrom(suggestion.recipientName)}
              </span>
              <span className="text-[15px] font-semibold leading-tight">
                {suggestion.recipientName}
              </span>
              <span className="text-[13px] text-sage">
                {suggestion.city}
              </span>
              <span className="mt-auto pt-2 text-[14px] font-semibold text-rose">
                Speichern
              </span>
            </Link>
          </li>
        )}

        {addresses.map((a) => (
          <li
            key={a.id}
            className="shrink-0 w-[148px] lg:w-auto snap-start"
          >
            <Link
              href="/kategorie/alle-anlaesse"
              className="min-h-[190px] h-full p-4 border border-mist bg-white flex flex-col items-center text-center gap-1 text-bark hover:border-oak transition-colors"
            >
              <span
                aria-hidden
                className="w-14 h-14 grid place-items-center bg-cream text-bark font-display text-[20px] mb-1.5"
              >
                {initialsFrom(a.recipientName)}
              </span>
              <span className="text-[15px] font-semibold leading-tight">
                {a.recipientName}
              </span>
              <span className="text-[13px] text-sage">{a.city}</span>
              <span className="mt-auto pt-2 text-[14px] font-semibold text-rose">
                Blumen senden
              </span>
            </Link>
          </li>
        ))}

        <li className="shrink-0 w-[148px] lg:w-auto snap-start">
          <Link
            href="/konto/adressen"
            className="min-h-[190px] h-full p-4 border border-dashed border-oak bg-white flex flex-col items-center justify-center gap-2 text-bark hover:border-rose hover:text-rose transition-colors"
          >
            <span
              aria-hidden
              className="w-11 h-11 bg-cream grid place-items-center text-[22px] text-sage"
            >
              +
            </span>
            <span className="text-[14px] font-semibold text-center">
              {hasAny ? "Neuer Empfänger" : "Ersten Empfänger hinzufügen"}
            </span>
          </Link>
        </li>
      </ul>
    </section>
  );
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}
