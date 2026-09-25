"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { clearCartCookie, readCartCookie } from "@/lib/cart/cookie";
import { clearCheckoutCookie, patchCheckoutCookie, readCheckoutCookie } from "./cookie";
import { reserveOrder, ReserveError } from "./reserve";
import {
  getAvailableRunSlots,
  getAvailableTimedSlots,
} from "./slots";
import type { DeliveryContextCookie } from "./types";
import { lookupPlz, resolveZoneByPlzOrtschaft } from "./zones";

/**
 * Server actions for the checkout flow.
 *
 * Each action rewrites the parts of the mb_checkout cookie it owns and
 * clears fields that a change invalidates (e.g. changing PLZ drops any
 * previously-selected slot).
 *
 * These are public URL endpoints in disguise (see CLAUDE.md red zone).
 * Validate every input.
 */

// -------- Step 1a: submit a PLZ -----------------------------------
//
// Two flows:
//   (a) 0 rows        -> throw with a German error message
//   (b) 1 row         -> write plz + ort + zid to the cookie, return "single"
//   (c) 2+ rows       -> write plz only, return "picker" - client renders
//                        the Ortschaft picker with the returned options
//
// The action returns the resolution so the client can render immediately
// without a second round-trip. The cookie is the persistent home of the
// state; the return value is convenience.

export type SubmitPlzResult =
  | { kind: "single"; ortschaft: string; zoneNameDe: string; feeGross: string; minOrderGross: string }
  | { kind: "picker"; options: Array<{ ortschaft: string; zoneNameDe: string; feeGross: string; minOrderGross: string }> }
  | { kind: "none" };

export async function submitPlzAction(plzRaw: string): Promise<SubmitPlzResult> {
  const plz = String(plzRaw ?? "").trim();
  if (!/^\d{4}$/.test(plz)) {
    throw new Error("Bitte geben Sie eine 4-stellige Postleitzahl ein.");
  }

  const result = await lookupPlz(plz);

  if (result.kind === "none") {
    // Persist nothing - the customer's typo shouldn't clobber a valid
    // earlier selection.
    return { kind: "none" };
  }

  if (result.kind === "single") {
    // One zone: commit fully in one shot.
    // Selecting a new PLZ invalidates any run/timed/pickup pick.
    await patchCheckoutCookie({
      plz: result.zone.plz,
      ort: result.zone.ortschaft,
      zid: result.zone.zoneId,
      rid: undefined,
      rda: undefined,
      pd: undefined,
    });
    revalidatePath("/kasse/lieferung");
    return {
      kind: "single",
      ortschaft: result.zone.ortschaft,
      zoneNameDe: result.zone.zoneNameDe,
      feeGross: result.zone.feeGross,
      minOrderGross: result.zone.minOrderGross,
    };
  }

  // Picker: write only the PLZ so the /kasse/lieferung page can render
  // the picker on refresh. Ortschaft + zone id get filled by the next
  // action (submitOrtschaftAction).
  await patchCheckoutCookie({
    plz,
    ort: undefined,
    zid: undefined,
    rid: undefined,
    rda: undefined,
    pd: undefined,
  });
  revalidatePath("/kasse/lieferung");
  return {
    kind: "picker",
    options: result.options.map((o) => ({
      ortschaft: o.ortschaft,
      zoneNameDe: o.zoneNameDe,
      feeGross: o.feeGross,
      minOrderGross: o.minOrderGross,
    })),
  };
}

// -------- Step 1b: submit an Ortschaft (only after a picker) --------

export async function submitOrtschaftAction(
  plzRaw: string,
  ortschaftRaw: string,
): Promise<void> {
  const plz = String(plzRaw ?? "").trim();
  const ortschaft = String(ortschaftRaw ?? "").trim();
  if (!/^\d{4}$/.test(plz)) throw new Error("Ungültige Postleitzahl.");
  if (!ortschaft) throw new Error("Bitte wählen Sie eine Ortschaft.");

  const zone = await resolveZoneByPlzOrtschaft(plz, ortschaft);
  if (!zone) {
    throw new Error(
      "Diese Kombination aus PLZ und Ortschaft existiert nicht in unseren Zonen.",
    );
  }

  await patchCheckoutCookie({
    plz: zone.plz,
    ort: zone.ortschaft,
    zid: zone.zoneId,
    rid: undefined,
    rda: undefined,
    pd: undefined,
  });
  revalidatePath("/kasse/lieferung");
}

// -------- Step 1c: pick a fulfilment type ---------------------------

export async function selectFulfilmentAction(
  kind: "run" | "timed",
): Promise<void> {
  if (kind !== "run" && kind !== "timed") {
    throw new Error("Ungültige Liefermethode");
  }
  await patchCheckoutCookie({
    ful: kind,
    // Changing the fulfilment kind invalidates any previous slot pick.
    rid: undefined,
    rda: undefined,
    pd: undefined,
  });
  revalidatePath("/kasse/lieferung");
}

// -------- Step 1d: pick a run slot ---------------------------------
//
// Server-side re-validation: caller may have a stale UI. Re-fetch
// available runs and reject anything the current classification
// disables. The actual FOR UPDATE lock happens at reserve time (5f).

export async function selectRunAction(runIdRaw: number): Promise<void> {
  const runId = Number(runIdRaw);
  if (!Number.isInteger(runId) || runId <= 0) {
    throw new Error("Ungültige Slot-ID");
  }
  const days = await getAvailableRunSlots();
  const found = days
    .flatMap((d) => d.slots)
    .find((s) => s.runId === runId && s.status.kind === "available");
  if (!found) {
    throw new Error(
      "Dieser Termin ist zwischenzeitlich nicht mehr verfügbar. Bitte wählen Sie einen anderen.",
    );
  }
  await patchCheckoutCookie({
    ful: "run",
    rid: runId,
    rda: undefined,
    pd: undefined,
  });
  revalidatePath("/kasse/lieferung");
}

// -------- Step 1e: pick a timed datetime ---------------------------

export async function selectTimedAction(isoStartRaw: string): Promise<void> {
  const iso = String(isoStartRaw ?? "").trim();
  if (!iso) throw new Error("Ungültiger Zeitpunkt");
  const days = await getAvailableTimedSlots();
  const found = days
    .flatMap((d) => d.hours)
    .find((h) => h.isoStart === iso && h.status.kind === "available");
  if (!found) {
    throw new Error(
      "Dieser Zeitpunkt ist zwischenzeitlich nicht mehr verfügbar. Bitte wählen Sie einen anderen.",
    );
  }
  await patchCheckoutCookie({
    ful: "timed",
    rda: iso,
    rid: undefined,
    pd: undefined,
  });
  revalidatePath("/kasse/lieferung");
}

// -------- Step 2: buyer + recipient + delivery-context form ----------
//
// Called from /kasse/lieferdaten. Validates every field, patches the
// mb_checkout cookie, redirects to /kasse/bestaetigen (5f). Every value
// gets re-validated at reserve time against the actual DB constraints;
// this action is the FIRST line of defence, not the last.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mustFill(field: string, value: string): string {
  const v = value.trim();
  if (!v) throw new Error(`${field} ist erforderlich`);
  return v;
}
function optional(value: string, cap: number): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  if (v.length > cap) return v.slice(0, cap);
  return v;
}

export async function submitDetailsAction(formData: FormData): Promise<void> {
  const buyerName = mustFill("Name", str(formData.get("bn")));
  if (buyerName.length > 120) throw new Error("Name zu lang");

  const buyerEmail = mustFill("E-Mail", str(formData.get("be"))).toLowerCase();
  if (!EMAIL_RE.test(buyerEmail)) throw new Error("Ungültige E-Mail-Adresse");
  if (buyerEmail.length > 254) throw new Error("E-Mail zu lang");

  const buyerPhone = mustFill("Telefon", str(formData.get("bp")));
  if (buyerPhone.length > 40) throw new Error("Telefon zu lang");

  const recipientName = mustFill("Empfängername", str(formData.get("rn")));
  if (recipientName.length > 120) throw new Error("Empfängername zu lang");

  const recipientPhone = optional(str(formData.get("rp")), 40);
  const street = mustFill("Strasse und Hausnummer", str(formData.get("st")));
  if (street.length > 200) throw new Error("Adresse zu lang");

  const dcRaw = str(formData.get("dc"));
  if (
    dcRaw !== "residential" &&
    dcRaw !== "business" &&
    dcRaw !== "hospital" &&
    dcRaw !== "funeral"
  ) {
    throw new Error("Ungültiger Lieferkontext");
  }
  const deliveryContext = dcRaw as DeliveryContextCookie;

  // Conditional required fields per context.
  let ward: string | undefined;
  let room: string | undefined;
  let deceased: string | undefined;
  let familyContact: string | undefined;
  if (deliveryContext === "hospital") {
    ward = mustFill("Abteilung / Station", str(formData.get("dw")));
    room = optional(str(formData.get("dm")), 80);
  } else if (deliveryContext === "funeral") {
    deceased = mustFill("Name der verstorbenen Person", str(formData.get("dn")));
    familyContact = mustFill(
      "Telefon Familienkontakt",
      str(formData.get("fc")),
    );
  }

  const instructions = optional(str(formData.get("di")), 500);
  const cardMessage = optional(str(formData.get("cm")), 500);
  const cardAnonymous = str(formData.get("ca")) === "on";
  const ribbonText =
    deliveryContext === "funeral"
      ? optional(str(formData.get("rt")), 100)
      : undefined;

  await patchCheckoutCookie({
    bn: buyerName,
    be: buyerEmail,
    bp: buyerPhone,
    rn: recipientName,
    rp: recipientPhone,
    st: street,
    dc: deliveryContext,
    dw: ward,
    dm: room,
    dn: deceased,
    fc: familyContact,
    di: instructions,
    cm: cardMessage,
    ca: cardAnonymous || undefined,
    rt: ribbonText,
  });

  redirect("/kasse/bestaetigen");
}

function str(v: FormDataEntryValue | null): string {
  return typeof v === "string" ? v : "";
}

// -------- Reset the whole checkout state --------

export async function resetCheckoutAction(): Promise<void> {
  await clearCheckoutCookie();
  revalidatePath("/kasse/lieferung");
}

// -------- Step 3: reserve the order --------
//
// Thin wrapper around reserveOrder that reads cookies, runs the
// transaction, and on success clears cart + checkout cookies then
// redirects to /kasse/erfolg?bestellnummer=<order_number>.
//
// ReserveError bubbles as a normal Error to the client's useTransition,
// so its German message shows up in the review page's error banner.
// Anything else is a real bug and we let it 500.

export async function reserveOrderAction(
  paymentMethodRaw: string,
): Promise<void> {
  const paymentMethod =
    paymentMethodRaw === "cash" || paymentMethodRaw === "invoice"
      ? paymentMethodRaw
      : null;
  if (!paymentMethod) throw new Error("Ungültige Zahlungsart.");

  const [cart, checkout] = await Promise.all([
    readCartCookie(),
    readCheckoutCookie(),
  ]);

  let result;
  try {
    result = await reserveOrder({ cart, checkout, paymentMethod });
  } catch (err) {
    // Business errors surface with their German message; anything else
    // is a real fault we want the error boundary + Sentry to see.
    if (err instanceof ReserveError) throw new Error(err.message);
    throw err;
  }

  await Promise.all([clearCartCookie(), clearCheckoutCookie()]);
  revalidatePath("/", "layout");
  redirect(`/kasse/erfolg?bestellnummer=${encodeURIComponent(result.orderNumber)}`);
}
