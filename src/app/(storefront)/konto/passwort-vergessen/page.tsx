import type { Metadata } from "next";
import Link from "next/link";
import { requestPasswordResetAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Passwort vergessen",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ sent?: string; error?: string }>;
};

export default async function PasswortVergessenPage({ searchParams }: PageProps) {
  const { sent, error } = await searchParams;

  if (sent === "1") {
    // Deliberately generic: we don't confirm whether the email is on
    // file. The user sees the same page whether the email matched or
    // not, to prevent account enumeration.
    return (
      <div className="max-w-md mx-auto px-4 lg:px-6 py-12 lg:py-20 space-y-6">
        <h1 className="font-display font-light text-bark text-[2rem] leading-[1.1]">
          Check your inbox.
        </h1>
        <p className="text-[15px] text-bark/75 leading-[1.6]">
          Falls ein Konto mit dieser E-Mail-Adresse existiert, haben
          wir Ihnen gerade eine Mail mit einem Link zum Zurücksetzen
          geschickt. Der Link ist eine Stunde gültig.
        </p>
        <p className="text-[13px] text-sage leading-[1.6]">
          Keine Mail bekommen? Prüfen Sie den Spam-Ordner. Bei weiteren
          Problemen rufen Sie uns an unter{" "}
          <a href="tel:+41565565609" className="text-rose hover:underline">
            056 556 56 09
          </a>
          .
        </p>
        <Link
          href="/konto/anmelden"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-bark hover:text-rose"
        >
          ← Zurück zum Login
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 lg:px-6 py-12 lg:py-20 space-y-6">
      <header className="space-y-2">
        <h1 className="font-display font-light text-bark text-[2rem] leading-[1.1]">
          Passwort vergessen?
        </h1>
        <p className="text-[14px] text-bark/75 leading-[1.6]">
          Geben Sie Ihre E-Mail-Adresse an. Wir senden Ihnen einen Link
          zum Zurücksetzen.
        </p>
      </header>

      {error === "rate-limited" && (
        <div className="border border-rose/40 bg-rose/10 text-bark px-4 py-3 text-[0.85rem]">
          Zu viele Versuche. Bitte warten Sie einige Minuten und
          versuchen Sie es erneut.
        </div>
      )}

      <form
        action={requestPasswordResetAction}
        className="flex flex-col gap-5"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] tracking-[0.12em] uppercase font-medium text-bark">
            E-Mail
          </span>
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            inputMode="email"
            autoFocus
            className="h-11 px-3 border border-mist bg-background text-[15px] focus:outline-none focus:border-rose"
          />
        </label>

        <button
          type="submit"
          className="h-12 px-6 bg-rose text-ivory text-[15px] font-semibold hover:brightness-110 transition-[filter]"
        >
          Link zum Zurücksetzen senden
        </button>
      </form>

      <Link
        href="/konto/anmelden"
        className="inline-flex items-center gap-2 text-[13px] font-semibold text-bark hover:text-rose"
      >
        ← Zurück zum Login
      </Link>
    </div>
  );
}
