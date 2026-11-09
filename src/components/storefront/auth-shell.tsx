import Link from "next/link";

type Mode = "login" | "register";

/**
 * Shared shell for /konto/anmelden and /konto/registrieren.
 *
 * Form on the left, "why have an account" visual on the right. On
 * narrow screens the visual stacks below. Tabs at the top of the form
 * side act as a nav between the two auth pages — whichever matches the
 * current `mode` is shown as current.
 *
 * The right visual deliberately has no image file. We don't have real
 * photography yet; a warm gradient + the shop's decorative branch SVG
 * carries the aesthetic until a real photo lands.
 */
export function AuthShell({
  mode,
  title,
  titleEmphasis,
  lead,
  children,
}: {
  mode: Mode;
  /** The non-italic part of the title, e.g. "Willkommen" */
  title: string;
  /** The italic/rose-accent part, e.g. "zurück." — rendered in Cormorant italic + rose */
  titleEmphasis: string;
  lead: string;
  children: React.ReactNode;
}) {
  const quote =
    mode === "login"
      ? "«Blumen sprechen, wenn Worte zu laut sind.»"
      : "«Jeder Strauss ist ein Gespräch zwischen zwei Menschen.»";

  return (
    // Root is a <div> (not <main>) — the storefront layout already
    // owns the page's single <main>. `-mb-16` cancels SiteFooter's
    // own `mt-16` so the image panel sits flush against the footer
    // on these two pages only (no site-wide spacing change).
    <div className="min-h-screen -mb-16 grid grid-cols-1 lg:grid-cols-2 bg-ivory text-bark">
      {/* ===== Form side ===== */}
      <section className="order-2 lg:order-1 min-w-0 flex justify-center items-center px-6 sm:px-8 py-14 lg:py-16 animate-in fade-in slide-in-from-bottom-1 duration-500">
        <div className="w-full max-w-[440px] flex flex-col gap-8">
          {/* Intro */}
          <div className="flex flex-col gap-3">
            <p className="m-0 text-[13px] tracking-[0.14em] uppercase text-rose font-semibold">
              Mein Konto
            </p>
            <h1 className="m-0 font-display font-light text-bark text-[clamp(30px,4vw,46px)] leading-[1.05] tracking-[-0.02em]">
              {title}{" "}
              <em className="italic text-rose not-italic-fallback">
                {titleEmphasis}
              </em>
            </h1>
            <p className="m-0 text-[16px] leading-[1.6] text-bark/70">{lead}</p>
          </div>

          {/* Tabs */}
          <nav
            aria-label="Anmelden oder registrieren"
            className="grid grid-cols-2 bg-cream rounded-md p-1"
          >
            <Tab href="/konto/anmelden" active={mode === "login"}>
              Anmelden
            </Tab>
            <Tab href="/konto/registrieren" active={mode === "register"}>
              Konto erstellen
            </Tab>
          </nav>

          {children}
        </div>
      </section>

      {/* ===== Visual side ===== */}
      <aside
        aria-label="Vorteile eines Kontos"
        className="order-1 lg:order-2 relative min-w-0 min-h-[360px] sm:min-h-[460px] lg:min-h-screen overflow-hidden text-ivory bg-bark"
      >
        {/* Background photo. object-cover + object-center keeps the
            roses framed regardless of the container's aspect ratio. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/auth-hero.jpg"
          alt=""
          loading="eager"
          fetchPriority="high"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />

        {/* Bottom-heavy gradient — darkens the lower half for quote
            legibility while letting the roses fully breathe up top. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(42,31,26,0) 40%, rgba(42,31,26,0.55) 70%, rgba(42,31,26,0.88) 100%)",
          }}
        />

        <div className="relative z-10 h-full min-h-[360px] sm:min-h-[460px] lg:min-h-screen p-8 sm:p-10 lg:p-14 flex flex-col justify-end gap-6 lg:gap-8">
          <blockquote className="m-0 flex flex-col gap-3 max-w-[460px]">
            <p className="m-0 font-display italic font-light text-[clamp(28px,3vw,38px)] leading-[1.15]">
              {quote}
            </p>
            <footer className="text-[14px] text-ivory/80">
              — Werkstatt-Notiz
            </footer>
          </blockquote>

          <ul className="m-0 p-0 pt-6 list-none border-t border-ivory/30 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-6">
            <Perk
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.5" />
                </svg>
              }
              title="Adressen speichern"
              sub="Mama, Büro, beste Freundin – mit einem Klick."
            />
            <Perk
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              }
              title="Nochmals bestellen"
              sub="Den Lieblingsstrauss wieder schicken."
            />
            <Perk
              icon={
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M2 7h11v9H2z" />
                  <path d="M13 10h4l3 3v3h-7z" />
                  <circle cx="6" cy="18" r="2" />
                  <circle cx="17" cy="18" r="2" />
                </svg>
              }
              title="Bestellungen im Blick"
              sub="Welche Tour, wann geliefert."
            />
          </ul>
        </div>
      </aside>
    </div>
  );
}

function Tab({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  const base = "grid place-items-center h-11 rounded text-[14px] transition-colors";
  if (active) {
    return (
      <span
        aria-current="page"
        className={`${base} bg-ivory text-bark font-semibold shadow-sm`}
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} bg-transparent text-bark/70 font-medium hover:text-bark`}
    >
      {children}
    </Link>
  );
}

function Perk({
  icon,
  title,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <li className="flex flex-col gap-2">
      {icon}
      <strong className="text-[15px] font-semibold">{title}</strong>
      <span className="text-[13px] text-ivory/80 leading-[1.5]">{sub}</span>
    </li>
  );
}

