import "server-only";
import { auth } from "@/auth";

/**
 * Gate every admin server action with this.
 *
 * The (admin) layout already redirects a non-admin session, but server
 * actions are PUBLIC URL endpoints you can't see — a logged-in customer
 * can POST to any `/admin/...` action without going through the layout.
 * CLAUDE.md red zone #2 explicitly flags this.
 *
 * Must check role, not just session presence: a customer-role JWT would
 * pass a bare `session?.user` check and gain write access to shop state.
 */
export async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user) throw new Error("Nicht angemeldet");
  if (session.user.role !== "admin") {
    throw new Error("Keine Berechtigung");
  }
}
