import type { Metadata } from "next";
import Link from "next/link";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import {
  isCustomerAuthRateLimited,
  recordCustomerAuthFailure,
} from "@/lib/customer-auth/rate-limit";
import { AuthPanel } from "@/components/storefront/auth-panel";

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
    <AuthPanel
      quote="Blumen sprechen, wenn Worte zu laut sind."
      attribution="Werkstatt-Notiz"
    >
      <header className="space-y-2 mb-8">
        <p className="text-[0.68rem] tracking-[0.2em] uppercase text-sage font-medium">
          Anmelden
        </p>
        <h1 className="font-display font-light text-bark text-[clamp(2rem,4vw,2.75rem)] leading-[1.1]">
          Willkommen zurück.
        </h1>
      </header>

      <form action={handleSignIn} className="space-y-5">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />

        <AuthField
          id="email"
          name="email"
          label="E-Mail-Adresse"
          type="email"
          autoComplete="email"
          required
        />

        <AuthField
          id="password"
          name="password"
          label="Passwort"
          type="password"
          autoComplete="current-password"
          required
        />

        {error === "CredentialsSignin" && (
          <p
            role="alert"
            className="text-[0.85rem] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            E-Mail oder Passwort ist falsch.
          </p>
        )}
        {error === "RateLimited" && (
          <p
            role="alert"
            className="text-[0.85rem] text-rose animate-in fade-in slide-in-from-top-1 duration-300"
          >
            Zu viele Versuche. Bitte warten Sie ca. 15 Minuten.
          </p>
        )}

        <button
          type="submit"
          className="group w-full bg-bark text-ivory px-6 py-3.5 text-[0.72rem] tracking-[0.16em] uppercase font-medium hover:bg-rose active:translate-y-px transition-all duration-200"
        >
          <span className="inline-flex items-center gap-2">
            Anmelden
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </span>
        </button>
      </form>

      <div className="pt-8 mt-8 border-t border-mist text-[0.82rem] text-bark/70 leading-[1.65] space-y-2">
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
    </AuthPanel>
  );
}

function AuthField({
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
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[0.68rem] tracking-[0.16em] uppercase text-sage font-medium"
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
        className="w-full border border-mist bg-ivory px-3 py-2.5 text-[0.95rem] text-bark placeholder:text-sage/60 focus:border-rose focus:ring-2 focus:ring-rose/15 focus:outline-none transition-colors duration-150"
      />
      {hint && <p className="text-[0.72rem] text-sage">{hint}</p>}
    </div>
  );
}
