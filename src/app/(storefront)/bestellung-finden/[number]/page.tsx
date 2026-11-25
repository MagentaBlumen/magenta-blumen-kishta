import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { auth } from "@/auth";
import { canSeeOrderView } from "@/lib/order-lookup/access";
import { fetchGuestOrderView } from "@/lib/order-lookup/fetch";
import { verifyOrderViewToken } from "@/lib/order-lookup/token";
import { formatChf } from "@/lib/money";
import type { OrderStatus } from "@/lib/admin/order-status";
import type { GuestOrderView } from "@/lib/order-lookup/fetch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ihre Bestellung",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ number: string }>;
};

export default async function GuestOrderViewPage({ params }: PageProps) {
  const { number } = await params;
  const orderNumber = decodeURIComponent(number);

  // Two auth paths lead here:
  //   1. Guest magic link in a fulfillment email writes a token cookie
  //      bound to this order number (verifyOrderViewToken).
  //   2. A logged-in customer clicks 'Details' in /konto — no token,
  //      but order.customer_id must match their session.
  // No match on either → 404.
  const [session, data] = await Promise.all([
    auth(),
    fetchGuestOrderView(orderNumber),
  ]);
  if (!data) notFound();

  const hasToken = await verifyOrderViewToken(orderNumber);
  const isOwner =
    session?.user?.role === "customer" &&
    session.user.customerId != null &&
    data.customerId != null &&
    data.customerId === session.user.customerId;
  if (!canSeeOrderView(session, data.customerId, hasToken)) notFound();

  const slotLabel = buildSlotLabel(data);
  const stage = stageFor(data.status);
  const placedAt = DateTime.fromJSDate(data.placedAt, {
    zone: "Europe/Zurich",
  }).setLocale("de-CH");

  return (
    <main
      className="max-w-[1120px] mx-auto px-4 lg:px-8 py-4 lg:py-10 pb-16 lg:pb-24 flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-x-12 gap-y-4"
      aria-labelledby="ord-title"
    >
      {/* Back link */}
      <Link
        href={isOwner ? "/konto/bestellungen" : "/"}
        className="lg:col-span-2 inline-flex items-center gap-2 min-h-11 text-[15px] font-semibold text-bark hover:text-rose transition-colors self-start"
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
          <path d="M19 12H5M11 18l-6-6 6-6" />
        </svg>
        {isOwner ? "Meine Bestellungen" : "Zurück zur Startseite"}
      </Link>

      {/* Header */}
      <header className="lg:col-span-2 flex flex-col gap-2 pb-2 lg:pb-4">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
          Ihre Bestellung
        </p>
        <h1
          id="ord-title"
          className="m-0 font-display font-light text-bark text-[clamp(28px,4.4vw,52px)] leading-[1.05] tracking-[-0.02em]"
        >
          Für <em className="italic text-rose">{data.recipientName}</em>
        </h1>
        <p className="m-0 text-[15px] leading-[1.5] text-sage">
          Nr. {data.orderNumber} ·{" "}
          <span className="whitespace-nowrap">
            bestellt am {placedAt.toFormat("cccc, d. LLLL, HH:mm")} Uhr
          </span>
        </p>
      </header>

      {/* Left column — status + delivery + card */}
      <div className="flex flex-col gap-4 min-w-0">
        <StatusSection
          stage={stage}
          status={data.status}
          slotLabel={slotLabel}
          placedAt={placedAt}
        />
        <DeliverySection data={data} />
        {(data.cardMessage || data.ribbonText) && (
          <CardMessageSection
            cardMessage={data.cardMessage}
            cardIsAnonymous={data.cardIsAnonymous}
            ribbonText={data.ribbonText}
          />
        )}
      </div>

      {/* Right column — wood summary + CTA + help */}
      <aside
        aria-label="Zusammenfassung"
        className="flex flex-col gap-3 lg:sticky lg:top-6 min-w-0"
      >
        <WoodSummary data={data} />
        <Link
          href="/kategorie/alle-anlaesse"
          className="inline-flex items-center justify-center gap-2 h-13 min-h-[52px] px-5 bg-rose text-ivory text-[16px] font-semibold hover:brightness-110 transition-[filter]"
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
        <a
          href="tel:+41565565609"
          className="border border-mist bg-white hover:border-oak transition-colors flex items-center gap-3.5 p-4 text-bark"
        >
          <span
            aria-hidden
            className="w-10 h-10 bg-cream text-rose grid place-items-center shrink-0"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z" />
            </svg>
          </span>
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-[14px] text-sage">
              Fragen zu dieser Bestellung?
            </span>
            <strong className="text-[18px] font-semibold text-bark">
              056 556 56 09
            </strong>
          </div>
        </a>
      </aside>
    </main>
  );
}

// ---------- Status timeline ----------

type Stage = "neu" | "gebunden" | "unterwegs" | "geliefert";
type StepState = "done" | "now" | "todo" | "skipped";

function stageFor(s: OrderStatus): Stage | "cancelled" | "failed" {
  switch (s) {
    case "new":
    case "confirmed":
      return "neu";
    case "in_production":
    case "ready":
      return "gebunden";
    case "out_for_delivery":
      return "unterwegs";
    case "delivery_failed":
      return "unterwegs";
    case "delivered":
      return "geliefert";
    case "cancelled":
      return "cancelled";
  }
}

const STAGE_ORDER: Stage[] = ["neu", "gebunden", "unterwegs", "geliefert"];
const STAGE_INDEX: Record<Stage, number> = {
  neu: 0,
  gebunden: 1,
  unterwegs: 2,
  geliefert: 3,
};
const STAGE_HEADING: Record<Stage, string> = {
  neu: "Bestellung erhalten",
  gebunden: "Fertig gebunden",
  unterwegs: "Unterwegs",
  geliefert: "Geliefert",
};
const STAGE_STEP_LABEL: Record<Stage, string> = {
  neu: "Bestellt",
  gebunden: "Gebunden",
  unterwegs: "Unterwegs",
  geliefert: "Geliefert",
};

function StatusSection({
  stage,
  status,
  slotLabel,
  placedAt,
}: {
  stage: ReturnType<typeof stageFor>;
  status: OrderStatus;
  slotLabel: string;
  placedAt: DateTime;
}) {
  if (stage === "cancelled") {
    return (
      <section className="border border-mist bg-white p-6 flex flex-col gap-2">
        <h2 className="m-0 font-display font-normal text-[26px] text-bark leading-[1.2]">
          Storniert
        </h2>
        <p className="m-0 text-[15px] text-sage">
          Diese Bestellung wurde storniert. Bei Fragen rufen Sie uns an
          unter 056 556 56 09.
        </p>
      </section>
    );
  }

  const stageIdx = STAGE_INDEX[stage as Stage];
  const heading = STAGE_HEADING[stage as Stage];
  const sub = subFor(stage as Stage, slotLabel);
  const failed = status === "delivery_failed";

  return (
    <section
      className="border border-mist bg-white p-6 flex flex-col gap-4"
      aria-labelledby="st-title"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="st-title"
          className="m-0 font-display font-normal text-[25px] sm:text-[28px] text-bark leading-[1.2]"
        >
          {heading}
        </h2>
        <p className="m-0 text-[15px] leading-[1.5] text-sage">{sub}</p>
      </div>

      {failed && (
        <p className="m-0 px-3 py-2 border border-rose/40 bg-rose/5 text-[14px] text-bark leading-[1.5]">
          Wir konnten nicht zustellen und melden uns bei Ihnen. Rufen Sie
          uns gern an, wenn Sie uns zuvorkommen möchten.
        </p>
      )}

      <ol className="list-none m-0 p-0 flex flex-col" aria-label="Verlauf">
        {STAGE_ORDER.map((s, i) => {
          const state: StepState =
            i < stageIdx ? "done" : i === stageIdx ? "now" : "todo";
          const isLast = i === STAGE_ORDER.length - 1;
          return (
            <StepRow
              key={s}
              label={STAGE_STEP_LABEL[s]}
              state={state}
              timestamp={
                s === "neu" && state === "done"
                  ? placedAt.toFormat("ccc, d. LLL · HH:mm")
                  : s === "neu" && state === "now"
                    ? placedAt.toFormat("ccc, d. LLL · HH:mm")
                    : null
              }
              hint={
                s === "unterwegs" && state === "now"
                  ? "mit unserem eigenen Lieferwagen"
                  : s === "geliefert" && state === "todo"
                    ? `erwartet ${slotLabel}`
                    : null
              }
              isLast={isLast}
            />
          );
        })}
      </ol>
    </section>
  );
}

function subFor(stage: Stage, slotLabel: string): string {
  switch (stage) {
    case "neu":
      return `Wir binden Ihre Blumen für ${slotLabel}.`;
    case "gebunden":
      return `Kommt mit der Tour: ${slotLabel}.`;
    case "unterwegs":
      return `Kommt ${slotLabel}.`;
    case "geliefert":
      return `Zugestellt: ${slotLabel}.`;
  }
}

function StepRow({
  label,
  state,
  timestamp,
  hint,
  isLast,
}: {
  label: string;
  state: StepState;
  timestamp: string | null;
  hint: string | null;
  isLast: boolean;
}) {
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-0">
      {!isLast && (
        <span
          aria-hidden
          className={`absolute left-[11px] top-7 bottom-0 w-[2px] ${
            state === "done" ? "bg-bark" : "bg-hair"
          }`}
        />
      )}
      <span
        aria-hidden
        className={`relative z-[1] w-6 h-6 rounded-full grid place-items-center text-[12px] font-bold shrink-0 ${
          state === "done"
            ? "bg-bark border-2 border-bark text-ivory"
            : state === "now"
              ? "bg-rose border-2 border-rose text-ivory shadow-[0_0_0_4px_#FBE8F1]"
              : "bg-white border-2 border-oak text-transparent"
        }`}
      >
        {state === "done" ? "✓" : "·"}
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5 min-w-0">
        <strong
          className={`text-[16px] ${
            state === "todo" ? "font-normal text-sage" : "font-semibold text-bark"
          }`}
        >
          {label}
        </strong>
        {(timestamp || hint) && (
          <span className="text-[14px] text-sage">
            {[timestamp, hint].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
    </li>
  );
}

// ---------- Delivery section ----------

function DeliverySection({ data }: { data: GuestOrderView }) {
  const addressLine = [
    data.deliveryStreet,
    [data.deliveryPlz, data.deliveryCity].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
  const contextLabel = contextLabelDe(data.deliveryContext);

  return (
    <section
      className="border border-mist bg-white p-6 flex flex-col gap-4"
      aria-labelledby="dl-title"
    >
      <h2
        id="dl-title"
        className="m-0 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage"
      >
        Lieferung
      </h2>
      <dl className="m-0 flex flex-col">
        <Fact icon={<PinIcon />} label="Wohin">
          <span>{data.recipientName}</span>
          {addressLine && (
            <span className="block text-[14px] text-sage mt-0.5">
              {addressLine}
              {contextLabel ? ` · ${contextLabel}` : ""}
            </span>
          )}
        </Fact>
      </dl>
    </section>
  );
}

function Fact({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5 py-3.5 border-t border-hair first:border-t-0 first:pt-0 last:pb-0">
      <span
        aria-hidden
        className="w-10 h-10 bg-cream text-sage grid place-items-center shrink-0"
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <dt className="text-[13px] text-sage">{label}</dt>
        <dd className="m-0 text-[16px] leading-[1.45] text-bark [overflow-wrap:anywhere]">
          {children}
        </dd>
      </div>
    </div>
  );
}

function PinIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function contextLabelDe(
  c: "residential" | "business" | "hospital" | "funeral",
): string {
  switch (c) {
    case "residential":
      return "Privatadresse";
    case "business":
      return "Firma / Büro";
    case "hospital":
      return "Spital";
    case "funeral":
      return "Trauerort";
  }
}

// ---------- Greeting card ----------

function CardMessageSection({
  cardMessage,
  cardIsAnonymous,
  ribbonText,
}: {
  cardMessage: string | null;
  cardIsAnonymous: boolean;
  ribbonText: string | null;
}) {
  return (
    <section
      className="border border-mist bg-white p-6 flex flex-col gap-4"
      aria-labelledby="ct-title"
    >
      <h2
        id="ct-title"
        className="m-0 text-[12px] font-semibold tracking-[0.14em] uppercase text-sage"
      >
        {ribbonText && !cardMessage ? "Trauerband" : "Grusskarte"}
      </h2>
      {cardMessage && (
        <figure className="m-0 p-6 bg-cream border border-mist flex flex-col gap-2.5">
          <blockquote className="m-0 font-display italic text-[20px] sm:text-[22px] leading-[1.45] text-bark">
            «{cardMessage}»
          </blockquote>
          <figcaption className="text-[13px] text-sage">
            Von Hand geschrieben
            {cardIsAnonymous ? " · anonym" : ""}
          </figcaption>
        </figure>
      )}
      {ribbonText && (
        <p className="m-0 text-[15px] text-bark">
          <span className="font-semibold">Trauerband:</span> «{ribbonText}»
        </p>
      )}
    </section>
  );
}

// ---------- Wood summary slab ----------

function WoodSummary({ data }: { data: GuestOrderView }) {
  const feeNum = Number(data.deliveryFeeGross);
  const feeFree = feeNum === 0;
  const giftcardNum = Number(data.giftcardAppliedGross);
  return (
    <div className="mb-wood p-6 flex flex-col gap-4 text-ivory">
      <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-[#EBDDC9]">
        Artikel
      </p>
      <ul className="m-0 p-0 list-none flex flex-col gap-3.5">
        {data.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-3">
            <span
              aria-hidden
              className="w-[52px] h-[52px] bg-white/10 grid place-items-center shrink-0 text-[#EBDDC9]"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-0.5 text-[15px]">
              <span className="truncate">{l.productNameDe}</span>
              <span className="text-[13px] text-[#D9C4A8]">
                {l.variantLabelDe ? `${l.variantLabelDe} · ` : ""}
                {l.quantity} Stück
              </span>
            </span>
            <span className="text-[15px] tabular-nums whitespace-nowrap">
              {formatChf(l.lineTotalGross)}
            </span>
          </li>
        ))}
      </ul>

      <dl className="m-0 pt-4 border-t border-white/20 flex flex-col gap-2.5 text-[15px]">
        <div className="flex justify-between gap-3">
          <dt className="text-[#EBDDC9]">Zwischensumme</dt>
          <dd className="m-0 tabular-nums">{formatChf(data.subtotalGross)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[#EBDDC9]">Lieferung</dt>
          <dd
            className={`m-0 ${feeFree ? "text-[#9BE3A8] font-semibold" : "tabular-nums"}`}
          >
            {feeFree ? "Gratis" : formatChf(data.deliveryFeeGross)}
          </dd>
        </div>
        {giftcardNum > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-[#EBDDC9]">Gutschein</dt>
            <dd className="m-0 tabular-nums">
              − {formatChf(data.giftcardAppliedGross)}
            </dd>
          </div>
        )}
      </dl>

      <div className="flex items-baseline justify-between gap-3 pt-4 border-t border-white/20">
        <strong className="text-[16px] font-semibold">Total</strong>
        <span className="font-display text-[32px] leading-none whitespace-nowrap tabular-nums">
          {formatChf(data.totalGross)}
        </span>
      </div>

      <p className="m-0 mt-1 flex items-center gap-2.5 px-3.5 py-3 bg-white/10 text-[15px]">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[#9BE3A8] shrink-0"
          aria-hidden
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
        {paymentSummaryDe(data.paymentSummary.isPaid, data.paymentSummary.method)}
      </p>
    </div>
  );
}

function paymentSummaryDe(
  isPaid: boolean,
  method: "cash" | "invoice" | "card" | "twint" | null,
): string {
  if (isPaid) {
    if (method === "cash") return "Bar bezahlt bei Lieferung";
    if (method === "invoice") return "Rechnung bezahlt";
    if (method === "twint") return "Bezahlt mit TWINT";
    if (method === "card") return "Bezahlt mit Karte";
    return "Bezahlt";
  }
  if (method === "cash") return "Bar bei Lieferung";
  if (method === "invoice") return "Rechnung per E-Mail";
  if (method === "card" || method === "twint") return "Zahlung ausstehend";
  return "Zahlung offen";
}

// ---------- Slot label ----------

function buildSlotLabel(data: {
  fulfilment: "run" | "timed" | "pickup" | "post";
  requestedDeliveryAt: Date | null;
  deliveryDate: string | null;
  sortTime: string | null;
  run: { runDate: string; windowStart: string; windowEnd: string } | null;
}): string {
  if (data.fulfilment === "timed" && data.requestedDeliveryAt) {
    return (
      DateTime.fromJSDate(data.requestedDeliveryAt, { zone: "Europe/Zurich" })
        .setLocale("de-CH")
        .toFormat("cccc, d. LLLL · HH:mm") + " Uhr"
    );
  }
  if (data.fulfilment === "run" && data.run) {
    const d = DateTime.fromISO(data.run.runDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc, d. LLLL");
    return `${d}, ${data.run.windowStart.slice(0, 5)}–${data.run.windowEnd.slice(0, 5)} Uhr`;
  }
  if (data.fulfilment === "pickup" && data.deliveryDate) {
    const d = DateTime.fromISO(data.deliveryDate, { zone: "Europe/Zurich" })
      .setLocale("de-CH")
      .toFormat("cccc, d. LLLL");
    return `${d} · Abholung im Laden`;
  }
  return "Termin wird bestätigt";
}
