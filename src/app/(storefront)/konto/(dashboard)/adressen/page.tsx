import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { getSuggestedAddressFromLastOrder } from "@/lib/customer-auth/suggested-address";
import { AddressBook } from "../../_components/address-book";

export default async function KontoAddresses() {
  const session = await auth();
  if (!session?.user?.customerId || session.user.role !== "customer") {
    redirect("/konto/anmelden?callbackUrl=/konto/adressen");
  }
  const customerId = session.user.customerId;

  const addresses = await fetchCustomerAddresses(customerId);
  const suggestion = await getSuggestedAddressFromLastOrder(
    customerId,
    addresses,
  );

  return (
    <section className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <h1 className="m-0 font-display font-light text-bark text-[40px] leading-[1.05]">
          Empfänger
        </h1>
        <p className="m-0 text-[15px] text-sage">
          Gespeicherte Empfänger werden beim Bestellen automatisch ausgefüllt.
        </p>
      </header>

      <AddressBook addresses={addresses} suggestion={suggestion} />
    </section>
  );
}
