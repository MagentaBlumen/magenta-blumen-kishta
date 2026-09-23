import type { Metadata } from "next";
import "./globals.css";

// Fonts (Cormorant + DM Sans) loaded via CSS @import in globals.css.
//
// Would prefer next/font/google (self-hosted, no external request,
// zero layout shift), but Next.js 16.3.x + Turbopack has a bug with
// multi-weight font requests that breaks the production build:
//   "next/font/google queries have exactly one entry"
// Revisit when Next 17 lands or the Turbopack fix ships. Meanwhile
// Google Fonts CDN is fine - one extra request, cached by browsers.

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://178-104-239-168.nip.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Magenta Blumen — Blumen aus Neuenhof",
    template: "%s · Magenta Blumen",
  },
  description:
    "Frische Blumen aus Neuenhof AG. Lieferung im Aargau — zwei Touren täglich, auch am Sonntag.",
  applicationName: "Magenta Blumen",
  keywords: [
    "Blumen Neuenhof",
    "Blumen Aargau",
    "Blumenlieferung",
    "Florist",
    "Blumenstrauss",
    "Rosen",
    "Trauerfloristik",
    "Sonntag Lieferung",
  ],
  openGraph: {
    type: "website",
    locale: "de_CH",
    siteName: "Magenta Blumen",
    title: "Magenta Blumen — Blumen aus Neuenhof",
    description:
      "Frische Blumen aus Neuenhof AG. Lieferung im Aargau — zwei Touren täglich, auch am Sonntag.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Magenta Blumen — Blumen aus Neuenhof",
    description:
      "Frische Blumen aus Neuenhof AG. Lieferung im Aargau — zwei Touren täglich, auch am Sonntag.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="de-CH" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-body bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
