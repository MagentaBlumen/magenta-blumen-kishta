import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customer } from "@/db/schema/customer";

/**
 * Two auth flows, one NextAuth instance:
 *
 *   admin provider id = "admin"
 *     - ONE hardcoded account from .env.production
 *     - ADMIN_EMAIL + ADMIN_PASSWORD_HASH (bcrypt)
 *     - Shared by Sandra + the owner. Session role = "admin".
 *     - Signin page: /signin. Gates /admin/* in the admin layout.
 *
 *   customer provider id = "customer"
 *     - Rows in the customer table, email+password (bcrypt).
 *     - OPTIONAL per CLAUDE.md - guest checkout stays the default.
 *     - Signin page: /konto/anmelden. Gates /konto in that layout.
 *     - Password reset is NOT implemented in Phase 1 - calls to the
 *       shop are the recovery path. Email verification sends but
 *       nothing is gated on it (same policy).
 *
 * The provider id on signIn() picks between them. JWT carries `role`
 * so middleware / layouts can tell them apart cheaply.
 */

const adminEmail = process.env.ADMIN_EMAIL;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

if (!adminEmail || !adminPasswordHash) {
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
      id: "admin",
      name: "Admin",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        if (!adminEmail || !adminPasswordHash) return null;

        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (email !== adminEmail.toLowerCase()) return null;

        const ok = await bcrypt.compare(password, adminPasswordHash);
        if (!ok) return null;

        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
          role: "admin",
        };
      },
    }),
    Credentials({
      id: "customer",
      name: "Customer",
      credentials: {
        email: { label: "E-Mail", type: "email" },
        password: { label: "Passwort", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (email.length < 5 || password.length < 1) return null;

        // Case-insensitive via lower() to match the schema's expression
        // index. One row max.
        const [row] = await db
          .select({
            id: customer.id,
            email: customer.email,
            firstName: customer.firstName,
            lastName: customer.lastName,
            passwordHash: customer.passwordHash,
            anonymisedAt: customer.anonymisedAt,
          })
          .from(customer)
          .where(sql`lower(${customer.email}) = ${email}`)
          .limit(1);

        if (!row) return null;
        // Anonymised customers (FADP erasure) can never log in. Row is
        // kept intact for foreign keys on past orders.
        if (row.anonymisedAt) return null;

        const ok = await bcrypt.compare(password, row.passwordHash);
        if (!ok) return null;

        const displayName =
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          row.email;

        return {
          id: `customer:${row.id}`,
          email: row.email,
          name: displayName,
          role: "customer",
          customerId: row.id,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On first sign-in `user` is populated with whatever authorize()
      // returned; on subsequent requests only `token` is set. Persist
      // role + customerId onto the token so every request has them.
      if (user) {
        token.role = user.role;
        token.customerId = user.customerId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.role = token.role;
      session.user.customerId = token.customerId;
      return session;
    },
    authorized({ auth: session, request }) {
      const path = request.nextUrl.pathname;
      if (path.startsWith("/admin")) {
        return session?.user?.role === "admin";
      }
      // /konto is also gated by the konto layout; the authorized hook
      // is called from middleware (which we don't wire up today).
      // Layout-level checks are the real gate.
      return true;
    },
  },
});
