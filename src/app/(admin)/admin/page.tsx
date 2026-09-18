import { auth } from "@/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Placeholder Heute dashboard. Real one lands in a later session -
// "today's orders by run, print button per ticket" per CLAUDE.md.
export default async function AdminHomePage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">«Heute»</h1>
        <p className="text-muted-foreground mt-1">
          Willkommen, {session?.user?.email ?? "Admin"}.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Heutige Bestellungen</CardTitle>
          <CardDescription>
            Hier erscheinen die Touren des Tages, gruppiert nach Zeitfenster.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Noch nicht implementiert.
        </CardContent>
      </Card>
    </div>
  );
}
