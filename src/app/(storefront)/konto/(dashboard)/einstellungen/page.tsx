import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
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

  const fullName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.email.split("@")[0];
  const initials = initialsFrom(fullName);

  return (
    <section className="flex flex-col gap-7">
      {/* Identity header — visible only on phones where the sidebar
          user-card is hidden. Desktop already has it in the sidebar. */}
      <header className="lg:hidden flex items-center gap-4">
        <span
          aria-hidden
          className="w-16 h-16 grid place-items-center bg-rose text-ivory font-display text-[22px] shrink-0"
        >
          {initials}
        </span>
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="m-0 font-display font-normal text-[28px] leading-[1.1] text-bark">
            {fullName}
          </h1>
          <p className="m-0 text-[14px] text-sage break-all">{profile.email}</p>
        </div>
      </header>

      <h1 className="hidden lg:block m-0 font-display font-light text-bark text-[40px] leading-[1.05]">
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

      {/* Abmelden — only on phones. On desktop the sidebar carries it
          next to the user card. */}
      <form
        className="lg:hidden"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2.5 h-12 px-5 border border-bark text-bark text-[15px] font-semibold hover:bg-cream transition-colors"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 21H5V3h4" />
            <path d="M16 17l5-5-5-5M21 12H9" />
          </svg>
          Abmelden
        </button>
      </form>

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

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}
