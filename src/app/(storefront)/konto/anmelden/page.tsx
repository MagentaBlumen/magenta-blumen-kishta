import type { Metadata } from "next";
import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import {
  isCustomerAuthRateLimited,
  recordCustomerAuthFailure,
} from "@/lib/customer-auth/rate-limit";
import { AuthShell } from "@/components/storefront/auth-shell";
import { PasswordInput } from "@/components/storefront/password-input";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Anmelden",
  description: "Melden Sie sich bei Ihrem Magenta-Blumen-Konto an.",
  alternates: { canonical: "/konto/anmelden" },
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function AnmeldenPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role === "customer") redirect("/konto");

  const { callbackUrl = "/konto", error } = await searchParams;

  async function handleSignIn(formData: FormData) {
    "use server";
    const cb = (formData.get("callbackUrl") as string | null) ?? "/konto";

    if (await isCustomerAuthRateLimited()) {
      redirect(
        `/konto/anmelden?error=RateLimited&callbackUrl=${encodeURIComponent(cb)}`,
      );
    }

    try {
      await signIn("customer", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: cb,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        await recordCustomerAuthFailure();
        redirect(
          `/konto/anmelden?error=CredentialsSignin&callbackUrl=${encodeURIComponent(cb)}`,
        );
      }
      throw err;
    }
  }

  return (
    <AuthShell
      mode="login"
      title="Willkommen"
      titleEmphasis="zurück."
      lead="Melden Sie sich an, um Ihre Adressen und Bestellungen griffbereit zu haben."
    >
      <form action={handleSignIn} className="flex flex-col gap-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        {/* Email */}
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-[14px] font-semibold text-bark">
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@beispiel.ch"
            required
            className="w-full h-[52px] px-4 border border-bark/20 bg-ivory rounded text-[16px] text-bark placeholder:text-sage/60 focus:border-rose focus:ring-2 focus:ring-rose/15 focus:outline-none transition-colors"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-4">
            <label
              htmlFor="password"
              className="text-[14px] font-semibold text-bark"
            >
              Passwort
            </label>
            <a
              href="tel:+41565565609"
              className="text-[14px] font-medium text-rose hover:underline"
              title="Wir setzen das Passwort telefonisch zurück"
            >
              Passwort vergessen?
            </a>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
          />
        </div>

        {/* Error banners */}
        {error === "CredentialsSignin" && (
          <p
            role="alert"
            className="text-[14px] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            E-Mail oder Passwort ist falsch.
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
          Anmelden
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

      {/* Divider */}
      <div className="flex items-center gap-4 text-[13px] text-sage">
        <span className="flex-1 h-px bg-mist" aria-hidden />
        oder
        <span className="flex-1 h-px bg-mist" aria-hidden />
      </div>

      {/* Guest checkout CTA */}
      <Link
        href="/"
        className="group flex items-center justify-between gap-4 px-6 py-5 border border-bark/20 rounded-md hover:border-bark transition-colors"
      >
        <span className="flex flex-col gap-1">
          <span className="text-[16px] font-semibold text-bark">
            Ohne Konto bestellen
          </span>
          <span className="text-[14px] text-bark/70">
            Schnell als Gast – mit TWINT oder Karte bezahlen.
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

      <p className="m-0 text-[14px] leading-[1.6] text-bark/70">
        Probleme beim Anmelden? Rufen Sie uns an unter{" "}
        <a href="tel:+41565565609" className="text-rose font-medium hover:underline">
          056 556 56 09
        </a>{" "}
        – wir helfen gern.
      </p>
    </AuthShell>
  );
}
