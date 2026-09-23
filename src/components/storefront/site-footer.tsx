import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-mist bg-cream mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12 grid gap-10 md:grid-cols-4 text-[0.8rem] text-bark/70 font-light">
        <div className="space-y-2 md:col-span-1">
          <div className="font-display text-[1.4rem] text-bark leading-none">
            Magenta Blumen
          </div>
          <p className="pt-2">
            Kleine Blumen-Werkstatt in Neuenhof AG.
            <br />
            Lieferung im Aargau, auch am Sonntag.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark mb-3">
            Lieferung
          </div>
          <div>27 Postleitzahlen im Aargau</div>
          <div>Zwei Touren täglich: 10:00 & 16:00</div>
          <div>Ab CHF 40 · Gratis ab CHF 120</div>
        </div>

        <div className="space-y-2">
          <div className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark mb-3">
            Kontakt
          </div>
          <div>Zürcherstrasse 142</div>
          <div>5432 Neuenhof</div>
          <div className="pt-2">
            <a href="tel:+41565565609" className="hover:text-bark transition-colors">
              056 556 56 09
            </a>
          </div>
          <div>
            <a href="tel:+41763410232" className="hover:text-bark transition-colors">
              076 341 02 32
            </a>
          </div>
          <div className="pt-2">
            <a
              href="mailto:info@magenta-blumen.ch"
              className="hover:text-bark transition-colors"
            >
              info@magenta-blumen.ch
            </a>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[0.68rem] tracking-[0.16em] uppercase font-medium text-bark mb-3">
            Rechtliches
          </div>
          <FooterLink href="/impressum">Impressum</FooterLink>
          <FooterLink href="/agb">AGB</FooterLink>
          <FooterLink href="/datenschutz">Datenschutz</FooterLink>
        </div>
      </div>
      <div className="border-t border-mist">
        <div className="max-w-7xl mx-auto px-6 py-4 text-[0.7rem] text-sage flex flex-col md:flex-row md:items-center md:justify-between gap-2">
          <span>© {new Date().getFullYear()} Magenta Blumen · MWST CHE-363.951.581</span>
          <span>Mit Sorgfalt in Neuenhof</span>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div>
      <Link href={href} className="hover:text-bark transition-colors">
        {children}
      </Link>
    </div>
  );
}
