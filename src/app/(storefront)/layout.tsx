import { AnnouncementBar } from "@/components/storefront/announcement-bar";
import { SiteHeader } from "@/components/storefront/site-header";
import { SiteFooter } from "@/components/storefront/site-footer";
import { LocalBusinessJsonLd } from "@/components/storefront/local-business-jsonld";
import { cartItemCount } from "@/lib/cart/hydrate";

// Storefront caching: individual pages set `export const revalidate = 300`
// (5-minute stale-while-revalidate). Admin write actions call
// revalidatePath / revalidateTag so changes propagate immediately even
// within a revalidation window. Page speed matters - organic search is
// the acquisition channel.

// Public storefront layout. No auth check - customers browse anonymously,
// checkout is optional-account per the auth change (see CLAUDE.md).
export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Reads the cart cookie only, never the DB. Cart mutations call
  // revalidatePath("/", "layout") so this re-runs on the next render
  // after add/remove/qty change.
  const initialCartCount = await cartItemCount();

  return (
    <div className="min-h-screen flex flex-col bg-ivory text-bark">
      <LocalBusinessJsonLd />
      <AnnouncementBar />
      <SiteHeader initialCartCount={initialCartCount} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
