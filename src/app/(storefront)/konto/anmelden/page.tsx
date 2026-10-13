import type { Metadata } from "next";
import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import {
  isCustomerAuthRateLimited,
  recordCustomerAuthFailure,
} from "@/lib/customer-auth/rate-limit";

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
    <div className="max-w-md mx-auto px-4 lg:px-6 py-14 lg:py-20 space-y-8">
      <header className="space-y-2">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Anmelden
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(1.8rem,4vw,2.6rem)] leading-[1.1]">
          Willkommen zurück.
        </h1>
      </header>

      <form action={handleSignIn} className="space-y-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium"
          >
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:outline-none"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-[0.72rem] tracking-[0.16em] uppercase text-sage font-medium"
          >
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark focus:border-rose focus:outline-none"
          />
        </div>

        {error === "CredentialsSignin" && (
          <p className="text-[0.85rem] text-rose">
            E-Mail oder Passwort ist falsch.
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
          Anmelden
        </button>
      </form>

      <div className="pt-6 border-t border-mist text-[0.82rem] text-bark/70 leading-[1.65] space-y-2">
        <p>
          Noch kein Konto?{" "}
          <Link
            href="/konto/registrieren"
            className="text-rose hover:underline"
          >
            Jetzt erstellen
          </Link>
          .
        </p>
        <p>
          Passwort vergessen? Rufen Sie uns an unter{" "}
          <a href="tel:+41565565609" className="text-rose hover:underline">
            056 556 56 09
          </a>{" "}
          - wir setzen es zurück.
        </p>
      </div>
    </div>
  );
}
