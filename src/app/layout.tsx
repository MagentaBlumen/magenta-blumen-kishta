import type { Metadata } from "next";
import { Cormorant, DM_Sans } from "next/font/google";
import "./globals.css";

// Cormorant: serif for headings. We load 300/400/500/600 + italic 300/400
// because the Figma uses italic inside headings for emphasis
// ("Aussergewöhnliche Blumen, geliefert." — the "Blumen" is italic).
const cormorant = Cormorant({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
});

// DM Sans: body font. Light/regular/medium cover everything the design uses.
const dmSans = DM_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: {
    default: "Magenta Blumen — Blumen aus Neuenhof",
    template: "%s · Magenta Blumen",
  },
  description:
    "Frische Blumen aus Neuenhof AG. Lieferung im Aargau — zwei Touren täglich, auch am Sonntag.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="de-CH"
      className={`${cormorant.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-body bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
