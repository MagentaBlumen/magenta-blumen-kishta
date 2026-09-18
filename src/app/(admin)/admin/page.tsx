import { auth } from "@/auth";

// Placeholder Heute dashboard. Real one lands in a later session -
// "today's orders by run, print button per ticket" per CLAUDE.md.
export default async function AdminHomePage() {
  const session = await auth();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">«Heute»</h1>
      <p className="text-neutral-600">
        Willkommen, {session?.user?.email ?? "Admin"}.
      </p>
      <p className="text-sm text-neutral-500">
        Hier erscheinen die heutigen Bestellungen. Noch nicht implementiert.
      </p>
    </div>
  );
}
