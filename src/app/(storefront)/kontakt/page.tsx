import type { Metadata } from "next";
import Link from "next/link";
import { submitContactFormAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Nachricht an Magenta Blumen in Neuenhof AG. Wir melden uns in der Regel innerhalb eines Werktags.",
  alternates: { canonical: "/kontakt" },
};

type PageProps = {
  searchParams: Promise<{ ok?: string; error?: string }>;
};

export default async function KontaktPage({ searchParams }: PageProps) {
  const { ok, error } = await searchParams;
  const sent = ok === "1";

  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-10 lg:py-16 space-y-8">
      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Kontakt
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Schreiben Sie uns.
        </h1>
        <p className="text-[0.9rem] text-bark/75 leading-[1.6] font-light">
          Für Hochzeiten, Trauerfloristik und besondere Wünsche. Wir
          melden uns in der Regel innerhalb eines Werktags. Für
          dringende Anliegen rufen Sie uns am besten an unter{" "}
          <a href="tel:+41565565609" className="text-rose hover:underline">
            056 556 56 09
          </a>
          .
        </p>
      </header>

      {sent ? (
        <div className="border border-sage/40 bg-sage/10 text-bark px-4 py-6 flex flex-col gap-3">
          <strong className="font-medium">Danke für Ihre Nachricht.</strong>
          <p className="m-0 text-[0.9rem] leading-[1.6]">
            Wir haben Ihnen eine Bestätigung an Ihre E-Mail geschickt
            und melden uns in Kürze.
          </p>
          <Link
            href="/"
            className="self-start inline-flex items-center gap-2 text-[0.8rem] font-semibold text-bark hover:text-rose transition-colors"
          >
            Zur Startseite →
          </Link>
        </div>
      ) : (
        <form
          action={submitContactFormAction}
          className="flex flex-col gap-5"
          noValidate
        >
          {error && <ContactError kind={error} />}

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] tracking-[0.12em] uppercase font-medium text-bark">
              Name
            </span>
            <input
              name="name"
              type="text"
              required
              maxLength={120}
              autoComplete="name"
              className="h-11 px-3 border border-mist bg-background text-[15px] focus:outline-none focus:border-rose"
            />
          </label>

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
              className="h-11 px-3 border border-mist bg-background text-[15px] focus:outline-none focus:border-rose"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] tracking-[0.12em] uppercase font-medium text-bark">
              Telefon <span className="text-sage">(optional)</span>
            </span>
            <input
              name="phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              inputMode="tel"
              className="h-11 px-3 border border-mist bg-background text-[15px] focus:outline-none focus:border-rose"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[0.75rem] tracking-[0.12em] uppercase font-medium text-bark">
              Nachricht
            </span>
            <textarea
              name="message"
              required
              minLength={5}
              maxLength={2000}
              rows={6}
              className="px-3 py-2 border border-mist bg-background text-[15px] leading-[1.5] focus:outline-none focus:border-rose"
            />
          </label>

          <button
            type="submit"
            className="self-start inline-flex items-center gap-2 h-12 px-6 bg-rose text-ivory text-[15px] font-semibold hover:brightness-110 transition-[filter]"
          >
            Nachricht senden
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>

          <p className="text-[0.75rem] text-sage leading-[1.5]">
            Ihre Angaben werden ausschliesslich für die Beantwortung
            dieser Nachricht verwendet. Details in der{" "}
            <Link href="/datenschutz" className="text-rose hover:underline">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </form>
      )}
    </div>
  );
}

function ContactError({ kind }: { kind: string }) {
  const message =
    kind === "rate-limited"
      ? "Zu viele Anfragen in kurzer Zeit. Bitte versuchen Sie es in ein paar Minuten erneut."
      : kind === "invalid"
        ? "Bitte prüfen Sie die Angaben — Name, E-Mail und eine kurze Nachricht sind erforderlich."
        : kind === "send-failed"
          ? "Die Nachricht konnte gerade nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie an."
          : "Es gab ein Problem mit Ihrer Nachricht.";
  return (
    <div className="border border-rose/40 bg-rose/10 text-bark px-4 py-3 text-[0.85rem]">
      {message}
    </div>
  );
}
