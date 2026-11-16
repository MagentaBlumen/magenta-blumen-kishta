"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { DateTime } from "luxon";
import { setOrderStageAction } from "@/app/(admin)/admin/bestellung/[number]/actions";
import { formatChf } from "@/lib/money";
import { thumbUrl } from "@/lib/image-urls";
import type { OrderStatus } from "@/lib/admin/order-status";

export type OrderCardData = {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  fulfilment: "run" | "timed" | "pickup" | "post";
  recipientName: string;
  recipientPhone: string | null;
  buyerName: string;
  buyerPhone: string | null;
  deliveryStreet: string | null;
  deliveryPlz: string | null;
  deliveryCity: string | null;
  deliveryWard: string | null;
  deliveryRoom: string | null;
  requestedDeliveryAt: Date | null;
  totalGross: string;
  paymentMethod: "cash" | "invoice" | "card" | "twint" | null;
  firstLineProductName: string | null;
  firstLineVariantLabel: string | null;
  firstLineImageUrl: string | null;
  cardMessage: string | null;
  deliveryInstructions: string | null;
};

type Stage = "neu" | "fertig" | "unterwegs" | "geliefert";

const UI_LABEL: Record<Stage, string> = {
  neu: "Neu",
  fertig: "Fertig",
  unterwegs: "Unterwegs",
  geliefert: "Geliefert",
};

const PAY_LABEL: Record<"cash" | "invoice" | "card" | "twint", string> = {
  cash: "Bar bei Lieferung",
  invoice: "Rechnung",
  card: "Karte",
  twint: "TWINT",
};

function uiStageFor(s: OrderStatus): Stage {
  switch (s) {
    case "new":
    case "confirmed":
      return "neu";
    case "in_production":
    case "ready":
      return "fertig";
    case "out_for_delivery":
    case "delivery_failed":
      return "unterwegs";
    case "delivered":
    case "cancelled":
      return "geliefert";
  }
}

function nextStageFor(stage: Stage): { label: string; target: Stage } | null {
  if (stage === "neu")
    return { label: "Strauss ist fertig", target: "fertig" };
  if (stage === "fertig") return { label: "Losgefahren", target: "unterwegs" };
  if (stage === "unterwegs")
    return { label: "Ist geliefert", target: "geliefert" };
  return null;
}

function townOf(city: string | null): string {
  return city ? city : "";
}

export function OrderCard({ data: o }: { data: OrderCardData }) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const stage = uiStageFor(o.status);
  const done = stage === "geliefert";
  const next = done ? null : nextStageFor(stage);
  const town = townOf(o.deliveryCity);
  const addressLine = [o.deliveryStreet, o.deliveryPlz, o.deliveryCity]
    .filter(Boolean)
    .join(", ");
  const mapUrl = addressLine
    ? `https://maps.google.com/?q=${encodeURIComponent(addressLine)}`
    : null;
  const isCash = o.paymentMethod === "cash";
  const eventText =
    o.fulfilment === "timed" && o.requestedDeliveryAt
      ? `Zeremonie ${DateTime.fromJSDate(o.requestedDeliveryAt, { zone: "Europe/Zurich" }).setLocale("de-CH").toFormat("HH:mm")} Uhr`
      : null;

  function advance() {
    if (!next) return;
    startTransition(async () => {
      try {
        await setOrderStageAction(o.orderNumber, next.target);
        if (next.target === "geliefert") setExpanded(false);
      } catch (err) {
        console.error("status change failed:", err);
      }
    });
  }

  const detailsId = `o-${o.id}-d`;

  return (
    <article
      className={`o${done ? " o--done" : ""}`}
      data-no={o.orderNumber}
      aria-label={`Bestellung für ${o.recipientName}`}
    >
      <div className="o__row">
        {o.firstLineImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbUrl(o.firstLineImageUrl)} alt="" />
        ) : (
          <div style={{ width: 60, height: 60, background: "var(--a-sand)" }} />
        )}
        <div className="o__text">
          <span className="o__who">
            {o.recipientName}
            {town && <span> · {town}</span>}
          </span>
          {!done && (
            <span className="o__what">
              {o.firstLineProductName ?? "(Produkt gelöscht)"}
              {o.firstLineVariantLabel ? ` · ${o.firstLineVariantLabel}` : ""}
            </span>
          )}
          <span className="o__meta">
            <span className={`st st--${stage}`}>{UI_LABEL[stage]}</span>
            {eventText && !done && (
              <span className="o__event">{eventText}</span>
            )}
            {isCash && !done && (
              <span className="tag-cash">
                Bar kassieren {formatChf(o.totalGross)}
              </span>
            )}
          </span>
        </div>
        <div className="o__actions">
          {next && (
            <button
              type="button"
              className="o__next"
              onClick={advance}
              disabled={isPending}
            >
              <svg
                className="icon"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {next.target === "unterwegs" ? (
                  <>
                    <path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" />
                    <circle cx="7" cy="17.5" r="1.8" />
                    <circle cx="17" cy="17.5" r="1.8" />
                  </>
                ) : (
                  <path d="M5 12l5 5 9-10" />
                )}
              </svg>
              {isPending ? "…" : next.label}
            </button>
          )}
          <button
            type="button"
            className="o__toggle"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            aria-label={`Details zu ${o.recipientName}`}
          >
            <svg
              className="icon"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {o.cardMessage && !done && (
        <p className="o__card">«{o.cardMessage}»</p>
      )}

      <dl className="o__details" id={detailsId} hidden={!expanded}>
        <div className="o__fact">
          <dt>Adresse</dt>
          <dd>
            {o.recipientName}
            {addressLine && (
              <>
                <br />
                {addressLine.split(/,\s*/).map((piece, i) => (
                  <span key={i}>
                    {piece}
                    <br />
                  </span>
                ))}
              </>
            )}
            {o.deliveryWard && (
              <>
                Station {o.deliveryWard}
                {o.deliveryRoom ? `, Zimmer ${o.deliveryRoom}` : ""}
                <br />
              </>
            )}
            {mapUrl && (
              <a href={mapUrl} target="_blank" rel="noopener">
                Karte öffnen
              </a>
            )}
          </dd>
        </div>
        {o.recipientPhone && (
          <div className="o__fact">
            <dt>Telefon Empfänger</dt>
            <dd>
              <a href={`tel:${o.recipientPhone.replace(/\s/g, "")}`}>
                {o.recipientPhone}
              </a>
            </dd>
          </div>
        )}
        {o.deliveryInstructions && (
          <div className="o__fact">
            <dt>Hinweis</dt>
            <dd>{o.deliveryInstructions}</dd>
          </div>
        )}
        <div className="o__fact">
          <dt>Bestellt von</dt>
          <dd>
            {o.buyerName}
            {o.buyerPhone && (
              <>
                <br />
                <a href={`tel:${o.buyerPhone.replace(/\s/g, "")}`}>
                  {o.buyerPhone}
                </a>
              </>
            )}
          </dd>
        </div>
        <div className="o__fact">
          <dt>Bestellung</dt>
          <dd>
            <Link
              href={`/admin/bestellung/${encodeURIComponent(o.orderNumber)}`}
            >
              Nr. {o.orderNumber}
            </Link>
            <br />
            {formatChf(o.totalGross)}
            {o.paymentMethod && ` · ${PAY_LABEL[o.paymentMethod]}`}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      className="btn btn--print"
      onClick={() => window.print()}
    >
      <svg
        className="icon"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9V3h12v6" />
        <rect x="3" y="9" width="18" height="8" />
        <path d="M6 14h12v7H6z" />
      </svg>
      Tagesliste drucken
    </button>
  );
}
