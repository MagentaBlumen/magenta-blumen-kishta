import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { CheckoutProgress } from "@/components/storefront/checkout-progress";
import { KasseSummary } from "@/components/storefront/kasse-summary";
import { LieferdatenForm } from "@/components/storefront/lieferdaten-form";
import { hydrateCart } from "@/lib/cart/hydrate";
import { readCheckoutCookie } from "@/lib/checkout/cookie";
import { resolveZoneByPlzOrtschaft } from "@/lib/checkout/zones";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { fetchCustomerPrefill } from "@/lib/customer-auth/profile";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kasse . Ihre Angaben",
  robots: { index: false, follow: false },
};

// Checkout step 2: buyer + recipient + delivery-context form.
//
// Gates:
//   - Empty cart -> /warenkorb
//   - No zone or no slot picked yet -> /kasse/lieferung
export default async function KasseLieferdatenPage() {
  const cart = await hydrateCart();
  if (cart.lines.length === 0) redirect("/warenkorb");

  const checkout = await readCheckoutCookie();

  const step1Done =
    checkout.plz &&
    checkout.ort &&
    checkout.zid &&
    checkout.ful &&
    (checkout.rid !== undefined || checkout.rda !== undefined);
  if (!step1Done) redirect("/kasse/lieferung");

  const zone = await resolveZoneByPlzOrtschaft(checkout.plz!, checkout.ort!);
  if (!zone) redirect("/kasse/lieferung");

  // Logged-in customer? Prefill buyer fields from their profile +
  // offer saved addresses matching the picked PLZ. Cookie values still
  // win over profile — a shopper buying for someone else may want to
  // type a different buyer email and we won't fight them.
  const session = await auth();
  const defaults = { ...checkout };
  let savedAddresses: Awaited<ReturnType<typeof fetchCustomerAddresses>> = [];
  let totalSavedCount = 0;
  if (session?.user?.role === "customer" && session.user.customerId) {
    const [profile, addrs] = await Promise.all([
      fetchCustomerPrefill(session.user.customerId),
      fetchCustomerAddresses(session.user.customerId),
    ]);
    if (profile) {
      if (!defaults.bn) defaults.bn = profile.name;
      if (!defaults.be) defaults.be = profile.email;
      if (!defaults.bp && profile.phone) defaults.bp = profile.phone;
    }
    totalSavedCount = addrs.length;
    // Match on trimmed PLZ — char(4) columns can return padded via
    // some driver paths; trimming on both sides keeps the comparison
    // honest regardless of how pg-js returns the column.
    const zonePlz = zone.plz.trim();
    savedAddresses = addrs.filter((a) => a.plz.trim() === zonePlz);
  }

  return (
    <main className="max-w-[1200px] mx-auto px-4 lg:px-8 py-8 lg:py-10 pb-24 flex flex-col gap-8">
      <CheckoutProgress current="angaben" />

      <div className="flex flex-col gap-2.5">
        <p className="m-0 text-[12px] font-semibold tracking-[0.16em] uppercase text-rose">
          Kasse
        </p>
        <h1 className="m-0 font-display font-light text-bark text-[clamp(36px,4vw,52px)] leading-[1.05] tracking-[-0.025em]">
          Ihre <em className="italic text-rose">Angaben</em>
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row flex-wrap gap-10 lg:gap-14 items-start">
        <div className="w-full lg:flex-[7_1_520px] min-w-0">
          <LieferdatenForm
            defaults={defaults}
            zone={zone}
            savedAddresses={savedAddresses}
            totalSavedCount={totalSavedCount}
          />
        </div>

        <KasseSummary cart={cart} zone={zone} checkout={checkout} />
      </div>
    </main>
  );
}
