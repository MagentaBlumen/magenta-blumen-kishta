import Link from "next/link";
import { redirect } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { fetchCustomerProfile } from "@/lib/customer-auth/profile";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { getSuggestedAddressFromLastOrder } from "@/lib/customer-auth/suggested-address";
import { getNextDeliverySlot } from "@/lib/delivery/next-slot";
import { formatChf } from "@/lib/money";
import type { CustomerOrderRow } from "@/lib/customer-auth/orders";

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
  const nextSlot = getNextDeliverySlot();
  const firstName = profile.firstName || profile.email.split("@")[0];
  const lastOrder = orders[0] ?? null;

  return (
    <section className="flex flex-col gap-7">
      <header className="flex flex-col gap-2.5">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
          Mein Konto
        </p>
        <h1 className="m-0 font-display font-light text-bark text-[clamp(38px,4.2vw,54px)] leading-[1.02] tracking-[-0.025em]">
          Guten Tag,{" "}
          <em className="italic text-rose">{firstName}.</em>
        </h1>
      </header>

      {lastOrder && <LastOrderCard order={lastOrder} />}

      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
        <NextTourTile slot={nextSlot} />
        {suggestion ? (
          <AddressSuggestionTile recipientName={suggestion.recipientName} />
        ) : (
          <BrowseCategoryTile />
        )}
      </div>
    </section>
  );
}

function LastOrderCard({ order: o }: { order: CustomerOrderRow }) {
  const delivered = o.status === "delivered";
  const cancelled = o.status === "cancelled";
  const when = o.deliveryDate
    ? DateTime.fromISO(o.deliveryDate, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("cccc, d. LLLL")
    : DateTime.fromJSDate(o.placedAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("cccc, d. LLLL");

  const statusLine = delivered
    ? `Geliefert an ${o.recipientName}`
    : cancelled
      ? `Storniert · ${o.recipientName}`
      : `Unterwegs zu ${o.recipientName}`;

  return (
    <article className="border border-[#E1D5C7]">
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 border-b border-[#E6DDD2]">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden
            className={`w-10 h-10 grid place-items-center text-[18px] font-bold shrink-0 ${
              delivered
                ? "bg-[#EAF3E6] text-[#2F6B3E]"
                : cancelled
                  ? "bg-stone-100 text-stone-500"
                  : "bg-[#FBEAF1] text-rose"
            }`}
          >
            {delivered ? "✓" : cancelled ? "–" : "→"}
          </span>
          <div>
            <h2 className="m-0 font-display font-normal text-[24px] leading-[1.2] text-bark">
              {statusLine}
            </h2>
            <span className="text-[14px] text-sage">{when}</span>
          </div>
        </div>
        <span className="text-[13px] text-sage">Letzte Bestellung</span>
      </div>

      <div className="px-6 py-5 flex flex-wrap items-center gap-5">
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <strong className="text-[15px] font-semibold text-bark">
            Bestellung {o.orderNumber}
          </strong>
          <span className="text-[13px] text-sage tabular-nums">
            {formatChf(o.totalGross)}
          </span>
        </div>
        <div className="flex items-center gap-5">
          <Link
            href={`/bestellung-finden/${o.orderNumber}`}
            className="underline text-[13px] text-sage hover:text-rose transition-colors"
          >
            Details
          </Link>
          {/* TODO: reorder-to-cart action doesn't exist yet. For now this
              drops the customer into the catalogue. */}
          <Link
            href="/kategorie/alle-anlaesse"
            className="inline-flex items-center gap-2 h-11 px-4 bg-rose text-ivory text-[14px] font-semibold hover:brightness-110 transition-[filter]"
          >
            <svg
              width="15"
              height="15"
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

function NextTourTile({
  slot,
}: {
  slot: Awaited<ReturnType<typeof getNextDeliverySlot>>;
}) {
  return (
    <Link
      href="/kategorie/alle-anlaesse"
      className="mb-wood min-h-[168px] p-6 flex flex-col justify-between gap-5 transition-[filter] hover:brightness-110"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-[#EBDDC9]">
          Nächste Tour
        </span>
        {slot ? (
          <>
            <span className="font-display text-[32px] leading-[1.05]">
              {slot.dayLabel}{" "}
              <em className="italic">{slot.timeLabel}</em>
            </span>
            <span className="text-[13px] text-[#EBDDC9]">
              bestellen bis {slot.cutoffPrefixDe}
              {slot.cutoffTimeLabel} Uhr
            </span>
          </>
        ) : (
          <span className="font-display text-[26px] leading-[1.2]">
            Keine Tour in Reichweite.
          </span>
        )}
      </div>
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold">
        Blumen bestellen
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

function AddressSuggestionTile({ recipientName }: { recipientName: string }) {
  return (
    <Link
      href="/konto/adressen"
      className="min-h-[168px] p-6 border border-[#E1D5C7] bg-white text-bark hover:border-[#B8916A] transition-colors flex flex-col justify-between gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
          Adressbuch
        </span>
        <span className="font-display text-[24px] leading-[1.2]">
          {recipientName} speichern?
        </span>
        <span className="text-[13px] text-sage">
          Dann ist die Adresse beim nächsten Mal schon ausgefüllt.
        </span>
      </div>
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-rose">
        Zum Adressbuch
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}

function BrowseCategoryTile() {
  return (
    <Link
      href="/bestellung-finden"
      className="min-h-[168px] p-6 border border-[#E1D5C7] bg-white text-bark hover:border-[#B8916A] transition-colors flex flex-col justify-between gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] font-semibold tracking-[0.14em] uppercase text-sage">
          Gast-Bestellung
        </span>
        <span className="font-display text-[24px] leading-[1.2]">
          Früher einmal ohne Konto bestellt?
        </span>
        <span className="text-[13px] text-sage">
          Status mit Bestellnummer und E-Mail finden.
        </span>
      </div>
      <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-rose">
        Bestellung finden
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
