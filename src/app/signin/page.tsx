import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

// Server-rendered sign-in with a Server Action - no client bundle
// needed for a form this simple.
type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl = "/admin", error } = await searchParams;

  async function handleSignIn(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: (formData.get("callbackUrl") as string | null) ?? "/admin",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(`/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(
          (formData.get("callbackUrl") as string | null) ?? "/admin",
        )}`);
      }
      throw err;
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form
        action={handleSignIn}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">Admin-Anmeldung</h1>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div className="space-y-1">
          <label htmlFor="email" className="text-sm text-neutral-700">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-neutral-700">
            Passwort
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
          />
        </div>
        {error === "CredentialsSignin" && (
          <p className="text-sm text-red-600">E-Mail oder Passwort ist falsch.</p>
        )}
        <button
          type="submit"
          className="w-full rounded bg-neutral-900 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Anmelden
        </button>
      </form>
    </div>
  );
}
