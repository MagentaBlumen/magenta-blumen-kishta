import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { LocalBusinessJsonLd } from "@/components/storefront/local-business-jsonld";

// Storefront caching: pages that don't depend on the request (home,
// catalogue, product detail, colour, legal) set `export const revalidate = 300`
// and get served from the ISR cache. Admin write actions call
// revalidateTag / revalidatePath so edits propagate within the window.
// The layout itself MUST NOT read cookies or session — doing so would
// opt every page under it out of caching. The cart-badge count is
// fetched client-side from /api/cart/count instead (see SiteHeader).

// Public storefront layout. No auth check - customers browse anonymously,
// checkout is optional-account per the auth change (see CLAUDE.md).
export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-ivory text-bark">
      <LocalBusinessJsonLd />
      <AnnouncementBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
