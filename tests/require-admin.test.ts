/**
 * `requireAdmin` guards every admin server action and now also the
 * admin order-detail + Bon pages. This test pins the three states that
 * matter: no session, customer session, admin session.
 *
 * Delete `if (session.user.role !== "admin") throw ...` in
 * `src/lib/admin/require-admin.ts` and the "rejects a logged-in
 * customer" test fails.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";
import { requireAdmin } from "@/lib/admin/require-admin";

// `auth` in NextAuth v5 is a polymorphic function (middleware OR
// Session fetcher). Here we only need the Session-fetcher shape.
const mockAuth = vi.mocked(auth as unknown as () => Promise<Session | null>);

beforeEach(() => {
  mockAuth.mockReset();
});

describe("requireAdmin", () => {
  it("throws on a logged-out session", async () => {
    mockAuth.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("Nicht angemeldet");
  });

  it("throws on a logged-in customer session", async () => {
    mockAuth.mockResolvedValue({
      user: { role: "customer", customerId: 42 },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await expect(requireAdmin()).rejects.toThrow("Keine Berechtigung");
  });

  it("passes on an admin session", async () => {
    mockAuth.mockResolvedValue({
      user: { role: "admin" },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await expect(requireAdmin()).resolves.toBeUndefined();
  });
});
