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
    <main className="min-h-screen flex flex-wrap bg-ivory text-bark">
      {/* ===== Form side ===== */}
      <section className="flex-1 basis-[520px] min-w-0 flex justify-center px-6 sm:px-8 py-16 sm:py-20 animate-in fade-in slide-in-from-bottom-1 duration-500">
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
        className="relative flex-1 basis-[520px] min-w-0 min-h-[480px] lg:min-h-[640px] overflow-hidden text-ivory bg-gradient-to-br from-bark via-bark/90 to-rose/70"
      >
        {/* Decorative branch — same SVG used elsewhere, at low opacity */}
        <DecorativeBranch />
        {/* Soft darken at the bottom for quote legibility */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(42,31,26,0) 30%, rgba(42,31,26,0.78) 100%)",
          }}
        />

        <div className="relative z-10 h-full min-h-[480px] lg:min-h-[640px] p-10 lg:p-14 flex flex-col justify-end gap-8">
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
    </main>
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

function DecorativeBranch() {
  return (
    <svg
      aria-hidden
      className="absolute -right-10 -top-10 w-80 h-80 text-ivory/20 pointer-events-none"
      viewBox="0 0 200 200"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
    >
      <path d="M160 20 Q 140 70, 100 90 Q 60 110, 40 160" />
      <path d="M152 36 Q 156 28, 168 30" />
      <path d="M152 36 Q 148 46, 154 56" />
      <path d="M130 62 Q 130 52, 142 50" />
      <path d="M130 62 Q 126 72, 134 82" />
      <path d="M100 90 Q 96 80, 108 76" />
      <path d="M100 90 Q 94 100, 102 112" />
      <path d="M76 108 Q 68 100, 74 90" />
      <path d="M76 108 Q 70 120, 78 130" />
      <path d="M52 140 Q 42 136, 44 124" />
      <path d="M52 140 Q 46 152, 54 162" />
      <ellipse cx="170" cy="22" rx="4" ry="2.4" transform="rotate(30 170 22)" />
      <ellipse cx="156" cy="56" rx="4" ry="2.4" transform="rotate(-20 156 56)" />
      <ellipse cx="142" cy="50" rx="4" ry="2.4" transform="rotate(20 142 50)" />
      <ellipse cx="108" cy="76" rx="4" ry="2.4" transform="rotate(20 108 76)" />
      <ellipse cx="102" cy="112" rx="4" ry="2.4" transform="rotate(-25 102 112)" />
      <ellipse cx="78" cy="130" rx="4" ry="2.4" transform="rotate(-10 78 130)" />
      <ellipse cx="54" cy="162" rx="4" ry="2.4" transform="rotate(-15 54 162)" />
    </svg>
  );
}
