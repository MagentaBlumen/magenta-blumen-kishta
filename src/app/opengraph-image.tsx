import { ImageResponse } from "next/og";

/**
 * Default OG / Twitter card image for the whole site.
 *
 * Branded text-only placeholder because real hero photography is
 * blocked on a shoot (see project memory). A real JPG can replace this
 * file later without touching metadata - the filename convention
 * (opengraph-image.tsx at the root of /app) auto-wires it.
 *
 * Colours mirror the storefront palette (ivory background, bark text,
 * rose accent). Dimensions 1200x630 is the standard OG size.
 */

export const alt = "Magenta Blumen . Blumen aus Neuenhof";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Static OG for a soft launch - cache aggressively. If this ever
// becomes dynamic per-page, switch to export const runtime = "edge" and
// drop the force-static.
export const dynamic = "force-static";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "space-between",
          padding: "80px 96px",
          background: "#f9f6f1",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 24,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: "#4f6752",
            fontWeight: 500,
          }}
        >
          Neuenhof · AG
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 108,
              lineHeight: 1,
              color: "#2a1f1a",
              fontWeight: 300,
              letterSpacing: "-0.02em",
            }}
          >
            Magenta Blumen
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#2a1f1a",
              opacity: 0.75,
              fontWeight: 300,
              lineHeight: 1.3,
            }}
          >
            Frische Blumen aus Neuenhof. Lieferung im Aargau,
            <br />
            zwei Touren täglich, auch am Sonntag.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 22,
            color: "#a0185a",
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 36, lineHeight: 0.9 }}>·</span>
          magenta-blumen.ch
        </div>
      </div>
    ),
    { ...size },
  );
}
