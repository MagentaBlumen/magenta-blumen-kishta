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
  // Satori (the renderer behind next/og) rejects any element with
  // more than one child that is not explicitly `display: flex` /
  // `contents` / `none`. That includes a text node + <br/> combo,
  // so every multi-child container below is a flex column/row and
  // the two-line tagline is two sibling divs rather than one text
  // block with a <br/>.
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
            display: "flex",
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
              display: "flex",
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
              display: "flex",
              flexDirection: "column",
              fontSize: 32,
              color: "#2a1f1a",
              opacity: 0.75,
              fontWeight: 300,
              lineHeight: 1.3,
            }}
          >
            <div style={{ display: "flex" }}>
              Frische Blumen aus Neuenhof. Lieferung im Aargau,
            </div>
            <div style={{ display: "flex" }}>
              zwei Touren täglich, auch am Sonntag.
            </div>
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
          <div style={{ display: "flex", fontSize: 36, lineHeight: 0.9 }}>
            ·
          </div>
          <div style={{ display: "flex" }}>magenta-blumen.ch</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
