import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { fetchHeuteOrders } from "@/lib/admin/heute";
import "./admin.css";

export const dynamic = "force-dynamic";

// Every admin page re-checks auth server-side in addition to the
// middleware gate. Belt + braces — middleware can misfire on new
// routes, actions are public endpoints regardless.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/signin");

  // Badge count: today's orders that aren't delivered/cancelled yet.
  // Cheap — same query the Heute page runs, so React dedupes it in
  // practice once we reach the page render (and the layout always
  // renders before the page).
  const heute = await fetchHeuteOrders();
  const openOrderCount = heute.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  ).length;

  return (
    <div className="adm">
      <AdminSidebar openOrderCount={openOrderCount} />
      <main className="adm-main">
        <div className="adm-wrap">{children}</div>
      </main>
    </div>
  );
}
