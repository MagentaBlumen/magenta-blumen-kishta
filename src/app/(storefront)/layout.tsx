import Link from "next/link";

// Storefront pages hit the DB on every render. Marking the whole
// route group dynamic prevents Next.js from trying to prerender them
// at build time (which fails in CI where the DB doesn't exist).
// If we later want caching, add `revalidate = 60` per page.
export const dynamic = "force-dynamic";

// Public storefront layout. No auth check - customers browse anonymously,
// checkout is optional-account per the auth change (see CLAUDE.md).
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="font-semibold tracking-tight text-lg">
          Magenta Blumen
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/kategorie/geburtstag"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Geburtstag
          </Link>
          <Link
            href="/kategorie/liebe"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Liebe
          </Link>
          <Link
            href="/kategorie/trauer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Trauer
          </Link>
          <Link
            href="/kategorie/alle-anlaesse"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Alle Anlässe
          </Link>
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t bg-card mt-16">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground grid gap-6 md:grid-cols-3">
        <div className="space-y-1">
          <div className="font-medium text-foreground">Magenta Blumen</div>
          <div>Neuenhof AG, Schweiz</div>
          <div>MWST: CHE-363.951.581 MWST</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium text-foreground">Lieferung</div>
          <div>27 Postleitzahlen im Aargau</div>
          <div>Zwei Touren täglich: 10:00 und 16:00</div>
        </div>
        <div className="space-y-1">
          <div className="font-medium text-foreground">Kontakt</div>
          <Link href="#" className="hover:text-foreground">
            Impressum
          </Link>
          <br />
          <Link href="#" className="hover:text-foreground">
            AGB
          </Link>
          <br />
          <Link href="#" className="hover:text-foreground">
            Datenschutz
          </Link>
        </div>
      </div>
    </footer>
  );
}
