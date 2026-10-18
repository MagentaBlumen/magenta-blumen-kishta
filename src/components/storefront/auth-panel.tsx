/**
 * Shared left/right shell for /konto/registrieren and /konto/anmelden.
 *
 * Desktop: two-column with form on the left and a quiet typographic
 * panel on the right (no imagery - we don't have real photos yet; the
 * typography carries the shop's voice).
 *
 * Mobile: single column, no right panel.
 *
 * The right panel is a pure presentation shell; children on the left
 * are responsible for their own form + copy.
 */
export function AuthPanel({
  quote,
  attribution,
  children,
}: {
  quote: string;
  attribution: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-4rem)] grid lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-10 lg:py-14">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-500">
          {children}
        </div>
      </div>

      {/* Right panel - desktop only. Quiet cream background with a
          Cormorant quote. Vertical rule on the left edge echoes the
          storefront's typographic style. */}
      <aside
        className="hidden lg:flex items-center justify-center bg-cream relative overflow-hidden"
        aria-hidden
      >
        <div className="absolute left-0 top-16 bottom-16 w-px bg-mist" />
        <div className="max-w-sm px-10 space-y-6 animate-in fade-in duration-700">
          <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
            Magenta Blumen
          </p>
          <p className="font-display font-light text-bark text-[clamp(1.4rem,2.4vw,1.9rem)] leading-[1.35] italic">
            «{quote}»
          </p>
          <p className="text-[0.78rem] text-sage">— {attribution}</p>
        </div>
      </aside>
    </div>
  );
}
