import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isSigninRateLimited,
  recordSigninFailure,
} from "@/lib/auth/rate-limit";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { callbackUrl = "/admin", error } = await searchParams;

  async function handleSignIn(formData: FormData) {
    "use server";
    const cb = (formData.get("callbackUrl") as string | null) ?? "/admin";

    // Brute-force guard. 5 failed attempts per IP per 15 min blocks
    // subsequent attempts. Check BEFORE calling signIn so an attacker
    // can't keep probing while blocked.
    if (await isSigninRateLimited()) {
      redirect(
        `/signin?error=RateLimited&callbackUrl=${encodeURIComponent(cb)}`,
      );
    }

    try {
      await signIn("admin", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: cb,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        await recordSigninFailure();
        redirect(`/signin?error=CredentialsSignin&callbackUrl=${encodeURIComponent(cb)}`);
      }
      throw err;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Magenta Blumen . Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSignIn} className="space-y-4">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {error === "CredentialsSignin" && (
              <p className="text-sm text-destructive">
                E-Mail oder Passwort ist falsch.
              </p>
            )}
            {error === "RateLimited" && (
              <p className="text-sm text-destructive">
                Zu viele fehlgeschlagene Anmeldeversuche. Bitte warten Sie
                etwa 15 Minuten und versuchen Sie es erneut.
              </p>
            )}
            <Button type="submit" className="w-full">
              Anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
