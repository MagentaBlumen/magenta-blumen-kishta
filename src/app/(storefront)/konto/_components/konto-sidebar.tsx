import { signOut } from "@/auth";
import { KontoNav } from "./konto-nav";

export function KontoSidebar({
  firstName,
  lastName,
  email,
  orderCount,
  addressCount,
}: {
  firstName: string;
  lastName: string;
  email: string;
  orderCount: number;
  addressCount: number;
}) {
  const fullName =
    [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];
  const initials = initialsFrom(fullName);

  return (
    <aside className="w-full lg:w-[240px] lg:flex-none lg:sticky lg:top-6 flex flex-col gap-7">
      <div className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="w-[52px] h-[52px] grid place-items-center bg-rose text-ivory font-display text-[22px] shrink-0"
        >
          {initials}
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-display text-[19px] leading-[1.2] text-bark truncate">
            {fullName}
          </span>
          <span className="text-[13px] text-sage break-all">{email}</span>
        </div>
      </div>

      <KontoNav orderCount={orderCount} addressCount={addressCount} />

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="lg:pl-[17px]"
      >
        <button
          type="submit"
          className="inline-flex items-center gap-2 text-[14px] text-sage hover:text-rose transition-colors"
        >
          <svg
            width="16"
            height="16"
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
    </aside>
  );
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "";
  return (first + last).toUpperCase() || "?";
}
