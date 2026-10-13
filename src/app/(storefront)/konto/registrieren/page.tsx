import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { signupAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Konto erstellen",
  description:
    "Optionales Konto bei Magenta Blumen - speichert Ihre Daten für den nächsten Bestellvorgang.",
  alternates: { canonical: "/konto/registrieren" },
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

/**
 * Customer signup. Optional per CLAUDE.md - guest checkout stays the
 * default. The value prop here is "beim nächsten Mal werden Ihre
 * Daten vorausgefüllt" (prefill-only, never source of truth).
 *
 * If already logged in: bounce to /konto.
 */
export default async function RegistrierenPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role === "customer") redirect("/konto");

  const { error } = await searchParams;

  return (
    <div className="max-w-xl mx-auto px-4 lg:px-6 py-14 lg:py-20 space-y-8">
      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Konto erstellen
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,3rem)] leading-[1.1]">
          Beim nächsten Mal schneller.
        </h1>
        <p className="text-[0.9rem] text-bark/75 leading-[1.7] font-light">
          Mit einem Konto werden Ihre Angaben für die nächste Bestellung
          vorausgefüllt. Ein Konto ist optional - Sie können jederzeit als
          Gast bestellen.
        </p>
      </header>

      <form action={signupAction} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="firstName"
            name="firstName"
            label="Vorname"
            required
            autoComplete="given-name"
          />
          <Field
            id="lastName"
            name="lastName"
            label="Nachname"
            required
            autoComplete="family-name"
          />
        </div>

        <Field
          id="email"
          name="email"
          label="E-Mail-Adresse"
          type="email"
          required
          autoComplete="email"
        />

        <Field
          id="phone"
          name="phone"
          label="Telefonnummer"
          type="tel"
          required
          autoComplete="tel"
          hint="Für Rückfragen zur Lieferung."
        />

        <Field
          id="password"
          name="password"
          label="Passwort"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          hint="Mindestens 8 Zeichen."
        />

        {error === "email_exists" && (
          <p className="text-[0.85rem] text-rose">
            Für diese E-Mail besteht bereits ein Konto.{" "}
            <Link href="/konto/anmelden" className="underline">
              Jetzt anmelden
            </Link>
            .
          </p>
        )}
        {error === "weak_password" && (
          <p className="text-[0.85rem] text-rose">
            Das Passwort muss mindestens 8 Zeichen lang sein.
          </p>
        )}
        {error === "invalid" && (
          <p className="text-[0.85rem] text-rose">
            Bitte prüfen Sie die Eingaben.
          </p>
        )}
        {error === "RateLimited" && (
          <p className="text-[0.85rem] text-rose">
            Zu viele Versuche. Bitte warten Sie ca. 15 Minuten.
          </p>
        )}

        <button
          type="submit"
          className="w-full bg-bark text-ivory px-6 py-3 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose transition-colors"
        >
          Konto erstellen
        </button>
      </form>

      <div className="pt-6 border-t border-mist text-[0.82rem] text-bark/70 leading-[1.65] space-y-2">
        <p>
          Sie haben bereits ein Konto?{" "}
          <Link href="/konto/anmelden" className="text-rose hover:underline">
            Zur Anmeldung
          </Link>
          .
        </p>
        <p>
          Lieber als Gast bestellen?{" "}
          <Link href="/" className="text-rose hover:underline">
            Zur Startseite
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  type = "text",
  required,
  autoComplete,
  minLength,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="block text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium"
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:outline-none"
      />
      {hint && <p className="text-[0.72rem] text-sage">{hint}</p>}
    </div>
  );
}
