import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SearchBox } from "@/components/admin/search-box";

// Every admin page re-checks auth server-side in addition to the
// middleware gate. Belt + braces - middleware can misfire on new
// routes, actions are public endpoints regardless.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  // Role check too: a logged-in customer must NOT reach admin even if
  // they land on an admin URL by accident. The jwt callback stamps
  // role on every session, so missing/other-role fails this closed.
  if (!session?.user || session.user.role !== "admin") redirect("/signin");

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-6 min-w-0">
            <Link
              href="/admin"
              className="font-display text-[1.15rem] tracking-tight whitespace-nowrap text-foreground hover:text-rose transition-colors"
            >
              Magenta Blumen
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <NavLink href="/admin">Heute</NavLink>
              <NavLink href="/admin/produkte">Produkte</NavLink>
              <NavLink href="/admin/einstellungen">Einstellungen</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <SearchBox />
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {session.user.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/signin" });
              }}
            >
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="active:translate-y-px transition-transform"
              >
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 w-full flex-1 animate-in fade-in duration-300">
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative px-3 py-1.5 text-xs tracking-[0.1em] uppercase font-medium text-muted-foreground hover:text-foreground transition-colors group"
    >
      {children}
      <span className="absolute left-3 right-3 bottom-0 h-px bg-rose scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-200" />
    </Link>
  );
}
