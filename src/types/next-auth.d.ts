import type { DefaultSession } from "next-auth";

/**
 * JWT + Session augmentation so admin and customer auth can share one
 * NextAuth instance without the session shape being `any`.
 *
 * - role     : "admin" for Sandra/owner, "customer" for the public shop.
 * - customerId : populated for customers only; drives /konto queries.
 */
declare module "next-auth" {
  interface User {
    role?: "admin" | "customer";
    customerId?: number;
  }
  interface Session {
    user: {
      role?: "admin" | "customer";
      customerId?: number;
    } & DefaultSession["user"];
  }
}

// JWT in Auth.js v5 lives under @auth/core/jwt; next-auth/jwt re-exports
// from there, so the declaration must target the authoritative path.
declare module "@auth/core/jwt" {
  interface JWT {
    role?: "admin" | "customer";
    customerId?: number;
  }
}
