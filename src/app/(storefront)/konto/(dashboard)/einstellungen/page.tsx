import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { fetchCustomerProfile } from "@/lib/customer-auth/profile";
import { ProfileCard } from "../../_components/profile-card";
import { PasswordChangeCard } from "../../_components/password-change-card";

export default async function KontoSettings() {
  const session = await auth();
  if (!session?.user?.customerId || session.user.role !== "customer") {
    redirect("/konto/anmelden?callbackUrl=/konto/einstellungen");
  }

  const profile = await fetchCustomerProfile(session.user.customerId);
  if (!profile) redirect("/konto/anmelden");

  return (
    <section className="flex flex-col gap-7">
      <h1 className="m-0 font-display font-light text-bark text-[40px] leading-[1.05]">
        Profil
      </h1>

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

      <p className="m-0 text-[12px] leading-[1.6] text-sage">
        Datenschutz: Für die Löschung Ihrer Daten gemäss revidiertem
        Schweizer DSG schreiben Sie an{" "}
        <a
          href="mailto:info@magenta-blumen.ch"
          className="underline text-sage hover:text-rose transition-colors"
        >
          info@magenta-blumen.ch
        </a>
        . Bestelldaten mit Rechnungscharakter bewahren wir aus
        gesetzlichen Gründen auf.
      </p>
    </section>
  );
}
