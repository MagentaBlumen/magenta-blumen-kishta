import type { MetadataRoute } from "next";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://178-104-239-168.nip.io";

// Robots.txt. Public storefront is indexable; anything under /admin,
// /signin, /api, /monitoring (Sentry tunnel) is not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/signin", "/api/", "/monitoring/", "/warenkorb"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
