import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-top-bar";
import { fetchHeuteOrders } from "@/lib/admin/heute";
import "./admin.css";

export const dynamic = "force-dynamic";

// Admin needs viewport-fit=cover so the mobile bottom tab bar respects
// the iPhone home indicator via env(safe-area-inset-bottom).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: { default: "Verwaltung", template: "%s · Magenta Blumen" },
  robots: { index: false, follow: false },
};

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

  // Badge count = today's orders that aren't delivered/cancelled yet.
  const heute = await fetchHeuteOrders();
  const openOrderCount = heute.filter(
    (o) => o.status !== "delivered" && o.status !== "cancelled",
  ).length;

  return (
    <div className="adm">
      <AdminSidebar openOrderCount={openOrderCount} />
      <div className="adm-body">
        <AdminTopBar />
        <main className="adm-main">{children}</main>
      </div>
    </div>
  );
}
