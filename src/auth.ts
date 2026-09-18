import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

/**
 * Admin auth.
 *
 * ONE hardcoded account in .env.production:
 *   ADMIN_EMAIL          - the login email
 *   ADMIN_PASSWORD_HASH  - bcrypt hash of the password
 *                          Generate with: npx tsx scripts/hash-password.ts <pw>
 *
 * Sandra and the owner share this login. Two people, no reason yet for
 * per-user accounts. When we need an audit trail (which order was
 * marked paid by whom), migrate to a DB-backed admin_user table. See
 * CLAUDE.md rule 2 - schema change flagged first.
 *
 * Customer auth (guest checkout, optional accounts post-payment) is a
 * SEPARATE flow, built later. This module is admin-only.
 */

const adminEmail = process.env.ADMIN_EMAIL;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

// Fail loudly at boot rather than silently accepting all logins if the
// env is missing. Fine for prod; in dev/CI these can be dummy values.
if (!adminEmail || !adminPasswordHash) {
  // Warn but don't throw - CI builds without these should still succeed.
  // The Credentials.authorize below re-checks and returns null if unset.
  // eslint-disable-next-line no-console
  console.warn(
    "[auth] ADMIN_EMAIL or ADMIN_PASSWORD_HASH is not set. Admin login is disabled.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/signin",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!adminEmail || !adminPasswordHash) return null;

        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (email !== adminEmail.toLowerCase()) return null;

        // bcrypt.compare is constant-time - safe against timing attacks.
        const ok = await bcrypt.compare(password, adminPasswordHash);
        if (!ok) return null;

        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth: session, request }) {
      // Middleware calls this to decide access.
      const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");
      if (!isAdminRoute) return true;
      return !!session?.user;
    },
  },
});
