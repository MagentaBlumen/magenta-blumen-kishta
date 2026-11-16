import { signOut } from "@/auth";
import { KontoNav } from "./konto-nav";

export function KontoSidebar({
  orderCount,
  addressCount,
}: {
  orderCount: number;
  addressCount: number;
}) {
  // Sidebar is just the nav. The old user-card (avatar + name + email)
  // was removed — identity lives in each page's content ('Hallo, Laura.'
  // on Übersicht, the big identity header on Profil). Abmelden is the
  // last item of the nav list on desktop; on phones it's inside the
  // Profil tab (since the mobile nav is a fixed bottom tab bar).
  return (
    <aside className="w-full lg:w-[240px] lg:flex-none lg:sticky lg:top-6">
      <KontoNav
        orderCount={orderCount}
        addressCount={addressCount}
        trailing={
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
            className="hidden lg:block"
          >
            <button
              type="submit"
              className="w-full flex items-center gap-3 min-h-[52px] px-3.5 lg:pl-[17px] text-[15px] text-sage hover:text-rose transition-colors border-b border-hair"
            >
              <svg
                width="22"
                height="22"
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
        }
      />
    </aside>
  );
}
