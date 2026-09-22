import Link from "next/link";

// Placeholder cart page - Session 5 wires this up to a real
// server-persisted cart plus the slide-out drawer from the Figma
// design. For now the icon in the header lands here so it doesn't
// 404; the copy honestly says the feature is coming.

export const metadata = {
  title: "Warenkorb",
};

export default function WarenkorbPlaceholder() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-6">
      <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
        Warenkorb
      </p>
      <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
        Wird gerade eingebaut.
      </h1>
      <p className="text-[0.9rem] text-bark/70 leading-[1.7] font-light">
        Der Warenkorb und die Bestellfunktion sind noch nicht live.
        <br />
        Bis dahin können Sie im Laden vorbeikommen oder direkt anrufen.
      </p>
      <div className="pt-4">
        <Link
          href="/"
          className="inline-block bg-bark text-ivory px-9 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Zurück zur Startseite
        </Link>
      </div>
    </div>
  );
}
