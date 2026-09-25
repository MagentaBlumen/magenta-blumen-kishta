import type { MetadataRoute } from "next";
import {
  getAllCategoriesForSitemap,
  getAllProductsForSitemap,
} from "@/lib/cached-storefront";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://178-104-239-168.nip.io";

// Force-dynamic so we don't try to hit the DB during Docker build.
// Sitemap is served fresh (with the underlying queries cached via
// unstable_cache) on each request. At florist scale that's plenty.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    getAllProductsForSitemap(),
    getAllCategoriesForSitemap(),
  ]);

  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/ueber-uns`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const categoryEntries: MetadataRoute.Sitemap = categories.map((c) => ({
    url: `${SITE_URL}/kategorie/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const productEntries: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/produkt/${p.slug}`,
    lastModified: p.updatedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...categoryEntries, ...productEntries];
}
