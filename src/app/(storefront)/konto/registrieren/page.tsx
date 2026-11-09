import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthShell } from "@/components/storefront/auth-shell";
import { PasswordInput } from "@/components/storefront/password-input";
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

export default async function RegistrierenPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role === "customer") redirect("/konto");

  const { error } = await searchParams;

  return (
    <AuthShell
      mode="register"
      title="Beim nächsten Mal"
      titleEmphasis="schneller."
      lead="Mit einem Konto sind Ihre Angaben beim nächsten Besuch vorausgefüllt. Optional — Sie können jederzeit als Gast bestellen."
    >
      <form action={signupAction} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField
            id="firstName"
            name="firstName"
            label="Vorname"
            autoComplete="given-name"
            required
          />
          <TextField
            id="lastName"
            name="lastName"
            label="Nachname"
            autoComplete="family-name"
            required
          />
        </div>

        <TextField
          id="email"
          name="email"
          label="E-Mail-Adresse"
          type="email"
          autoComplete="email"
          placeholder="name@beispiel.ch"
          required
        />

        <TextField
          id="phone"
          name="phone"
          label="Telefonnummer"
          type="tel"
          autoComplete="tel"
          required
          hint="Für Rückfragen zur Lieferung."
        />

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-[14px] font-semibold text-bark"
          >
            Passwort
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={8}
          />
          <p className="text-[13px] text-bark/60">Mindestens 8 Zeichen.</p>
        </div>

        {error === "email_exists" && (
          <p
            role="alert"
            className="text-[14px] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            Für diese E-Mail besteht bereits ein Konto.{" "}
            <Link href="/konto/anmelden" className="underline">
              Jetzt anmelden
            </Link>
            .
          </p>
        )}
        {error === "weak_password" && (
          <p
            role="alert"
            className="text-[14px] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            Das Passwort muss mindestens 8 Zeichen lang sein.
          </p>
        )}
        {error === "invalid" && (
          <p
            role="alert"
            className="text-[14px] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            Bitte prüfen Sie die Eingaben.
          </p>
        )}
        {error === "RateLimited" && (
          <p
            role="alert"
            className="text-[14px] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            Zu viele Versuche. Bitte warten Sie ca. 15 Minuten.
          </p>
        )}

        <button
          type="submit"
          className="h-14 rounded bg-bark text-ivory text-[15px] font-semibold tracking-[0.02em] hover:bg-rose active:translate-y-px transition-all duration-200 inline-flex items-center justify-center gap-2.5"
        >
          Konto erstellen
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
      </form>

      <div className="flex items-center gap-4 text-[13px] text-sage">
        <span className="flex-1 h-px bg-mist" aria-hidden />
        oder
        <span className="flex-1 h-px bg-mist" aria-hidden />
      </div>

      <Link
        href="/"
        className="group flex items-center justify-between gap-4 px-6 py-5 border border-bark/20 rounded-md hover:border-bark transition-colors"
      >
        <span className="flex flex-col gap-1">
          <span className="text-[16px] font-semibold text-bark">
            Lieber als Gast bestellen
          </span>
          <span className="text-[14px] text-bark/70">
            Schnell und ohne Konto zur Kasse.
          </span>
        </span>
        <span className="text-bark transition-transform duration-200 group-hover:translate-x-1">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </Link>
    </AuthShell>
  );
}

function TextField({
  id,
  name,
  label,
  type = "text",
  required,
  autoComplete,
  placeholder,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[14px] font-semibold text-bark">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full h-[52px] px-4 border border-bark/20 bg-ivory rounded text-[16px] text-bark placeholder:text-sage/60 focus:border-rose focus:ring-2 focus:ring-rose/15 focus:outline-none transition-colors"
      />
      {hint && <p className="text-[13px] text-bark/60">{hint}</p>}
    </div>
  );
}
