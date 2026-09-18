import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

// Every admin page re-checks auth server-side in addition to the
// middleware gate. Belt + braces - middleware can misfire on new
// routes, actions are public endpoints regardless.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <nav className="flex items-center gap-6 text-sm">
            <a href="/admin" className="font-semibold">Magenta Blumen — Admin</a>
            <a href="/admin" className="text-neutral-600 hover:text-neutral-900">Heute</a>
            <a href="/admin/produkte" className="text-neutral-600 hover:text-neutral-900">Produkte</a>
            <a href="/admin/einstellungen" className="text-neutral-600 hover:text-neutral-900">Einstellungen</a>
          </nav>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/signin" });
            }}
          >
            <button type="submit" className="text-sm text-neutral-600 hover:text-neutral-900">
              Abmelden
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 w-full flex-1">{children}</main>
    </div>
  );
}
