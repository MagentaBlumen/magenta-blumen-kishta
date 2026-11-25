import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";
import { verifyPasswordResetToken } from "@/lib/customer-auth/account-tokens";
import { resetPasswordAction } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neues Passwort setzen",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function PasswortZuruecksetzenPage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const { error } = await searchParams;

  // Decode just the customerId from the token (shape-check only, no
  // signature yet — we need the current password hash before we can
  // verify the signature). Fetch the hash, then verify fully.
  const parts = token.split(".");
  const customerId = Number(parts[0]);
  if (!Number.isFinite(customerId) || customerId <= 0) {
    return <InvalidTokenView />;
  }

  const [row] = await db
    .select({
      id: customer.id,
      passwordHash: customer.passwordHash,
      anonymisedAt: customer.anonymisedAt,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
    .limit(1);

  if (!row || row.anonymisedAt) return <InvalidTokenView />;

  const verified = verifyPasswordResetToken(token, row.passwordHash);
  if (!verified.ok) return <InvalidTokenView reason={verified.reason} />;

  return (
    <div className="max-w-md mx-auto px-4 lg:px-6 py-12 lg:py-20 space-y-6">
      <header className="space-y-2">
        <h1 className="font-display font-light text-bark text-[2rem] leading-[1.1]">
          Neues Passwort setzen.
        </h1>
        <p className="text-[14px] text-bark/75 leading-[1.6]">
          Wählen Sie ein neues Passwort mit mindestens 8 Zeichen.
        </p>
      </header>

      {error === "weak" && (
        <div className="border border-rose/40 bg-rose/10 text-bark px-4 py-3 text-[0.85rem]">
          Das Passwort muss mindestens 8 Zeichen lang sein.
        </div>
      )}
      {error === "mismatch" && (
        <div className="border border-rose/40 bg-rose/10 text-bark px-4 py-3 text-[0.85rem]">
          Die beiden Passwörter stimmen nicht überein.
        </div>
      )}
      {error === "stale" && (
        <div className="border border-rose/40 bg-rose/10 text-bark px-4 py-3 text-[0.85rem]">
          Der Link ist abgelaufen oder wurde bereits verwendet. Bitte
          fordern Sie einen neuen an.
        </div>
      )}

      <form action={resetPasswordAction} className="flex flex-col gap-5">
        <input type="hidden" name="token" value={token} />

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] tracking-[0.12em] uppercase font-medium text-bark">
            Neues Passwort
          </span>
          <input
            name="newPassword"
            type="password"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            autoFocus
            className="h-11 px-3 border border-mist bg-background text-[15px] focus:outline-none focus:border-rose"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[0.75rem] tracking-[0.12em] uppercase font-medium text-bark">
            Passwort wiederholen
          </span>
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            className="h-11 px-3 border border-mist bg-background text-[15px] focus:outline-none focus:border-rose"
          />
        </label>

        <button
          type="submit"
          className="h-12 px-6 bg-rose text-ivory text-[15px] font-semibold hover:brightness-110 transition-[filter]"
        >
          Passwort speichern
        </button>
      </form>
    </div>
  );
}

function InvalidTokenView({ reason }: { reason?: string } = {}) {
  const msg =
    reason === "expired"
      ? "Der Link ist abgelaufen. Bitte fordern Sie einen neuen an."
      : reason === "signature"
        ? "Dieser Link wurde bereits verwendet oder ist ungültig geworden. Bitte fordern Sie einen neuen an."
        : "Der Link ist ungültig. Bitte fordern Sie einen neuen an.";
  return (
    <div className="max-w-md mx-auto px-4 lg:px-6 py-12 lg:py-20 space-y-6">
      <h1 className="font-display font-light text-bark text-[1.8rem] leading-[1.1]">
        Link ungültig.
      </h1>
      <p className="text-[14px] text-bark/75 leading-[1.6]">{msg}</p>
      <Link
        href="/konto/passwort-vergessen"
        className="inline-flex items-center gap-2 h-12 px-6 bg-bark text-ivory text-[14px] font-semibold hover:bg-rose transition-colors"
      >
        Neuen Link anfordern
      </Link>
    </div>
  );
}
