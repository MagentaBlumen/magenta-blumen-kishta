import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchCustomerProfile } from "@/lib/customer-auth/profile";
import { fetchCustomerOrders } from "@/lib/customer-auth/orders";
import { fetchCustomerAddresses } from "@/lib/customer-auth/addresses";
import { KontoSidebar } from "../_components/konto-sidebar";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mein Konto",
  robots: { index: false, follow: false },
};

// Auth gate + sidebar shell for the whole customer dashboard. Lives in
// the (dashboard) route group so /konto/anmelden and /konto/registrieren
// — which must stay reachable without a session — don't inherit it.
export default async function KontoDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const activeOrderCount = orders.filter(
    (o) => o.status !== "cancelled",
  ).length;

  return (
    <div className="max-w-[1200px] mx-auto px-4 lg:px-8 py-10 lg:py-14 flex flex-col lg:flex-row flex-wrap gap-8 lg:gap-14 items-start">
      <KontoSidebar
        firstName={profile.firstName}
        lastName={profile.lastName}
        email={profile.email}
        orderCount={activeOrderCount}
        addressCount={addresses.length}
      />
      <main className="flex-1 min-w-0 w-full lg:basis-[560px]">
        {children}
      </main>
    </div>
  );
}
