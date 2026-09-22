/**
 * Below-hero trust strip. 4 columns of icon + label + sub-label.
 * Copy rewritten from Figma's aspirational version to match reality
 * (per docs/storefront-copy-truth.md - no "Bestellung bis 14:00",
 * no "Lieferung am nächsten Tag", no international sourcing lies).
 */

type Item = {
  icon: React.ReactNode;
  label: string;
  sub: string;
};

const ITEMS: Item[] = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
      </svg>
    ),
    label: "Zwei Touren täglich",
    sub: "10:00 & 16:00",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="3" width="15" height="13" rx="1" />
        <path d="M16 8h4l3 3v5h-7V8z" />
        <circle cx="5.5" cy="18.5" r="2.5" />
        <circle cx="18.5" cy="18.5" r="2.5" />
      </svg>
    ),
    label: "Eigener Van",
    sub: "27 Postleitzahlen im Aargau",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    ),
    label: "Auch am Sonntag",
    sub: "Bestellcutoff 3 Stunden",
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
      </svg>
    ),
    label: "TWINT & Karte",
    sub: "Sofort bezahlen",
  },
];

export function TrustStrip() {
  return (
    <section className="border-y border-mist bg-cream">
      <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-2 lg:grid-cols-4 gap-y-8 gap-x-4 text-center">
        {ITEMS.map((item) => (
          <div key={item.label} className="flex flex-col items-center gap-1">
            <span className="text-rose flex items-center justify-center mb-0.5">
              {item.icon}
            </span>
            <span className="text-[0.72rem] tracking-[0.12em] uppercase font-medium text-bark">
              {item.label}
            </span>
            <span className="text-[0.72rem] text-sage">{item.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
