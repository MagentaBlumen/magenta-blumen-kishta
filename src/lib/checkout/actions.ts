"use server";

import { revalidatePath } from "next/cache";
import { clearCheckoutCookie, patchCheckoutCookie } from "./cookie";
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

// -------- Reset the whole checkout state --------

export async function resetCheckoutAction(): Promise<void> {
  await clearCheckoutCookie();
  revalidatePath("/kasse/lieferung");
}
