import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";

// Storefront caching: individual pages set `export const revalidate = 300`
// (5-minute stale-while-revalidate). Admin write actions call
// revalidatePath / revalidateTag so changes propagate immediately even
// within a revalidation window. Page speed matters - organic search is
// the acquisition channel.

// Public storefront layout. No auth check - customers browse anonymously,
// checkout is optional-account per the auth change (see CLAUDE.md).
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-ivory text-bark">
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
