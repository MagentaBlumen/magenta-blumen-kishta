/**
 * schema.org LocalBusiness structured data.
 *
 * Renders once in the storefront layout so every public page carries
 * it. Google + friends use this for the "knowledge panel", opening
 * hours, delivery area, business address.
 *
 * Some fields are stub (address street, phone) until Sandra / the
 * owner supply Impressum content in Session 8. Fine to ship the block
 * now with what we have - partial structured data is fine, wrong
 * structured data isn't.
 */
export function LocalBusinessJsonLd() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://178-104-239-168.nip.io";

  const data = {
    "@context": "https://schema.org",
    "@type": "Florist",
    name: "Magenta Blumen",
    url: siteUrl,
    email: "info@magenta-blumen.ch",
    telephone: "+41 56 556 56 09",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Zürcherstrasse 142",
      postalCode: "5432",
      addressLocality: "Neuenhof",
      addressRegion: "AG",
      addressCountry: "CH",
    },
    areaServed: {
      "@type": "AdministrativeArea",
      name: "Kanton Aargau",
    },
    priceRange: "CHF",
    // Two runs per day, all 7 days
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [
          "Monday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday",
        ],
        // Delivery runs; not physical opening. Structured data has no
        // clean way to distinguish, but this fits what the site claims.
        opens: "10:00",
        closes: "18:00",
      },
      // Tuesday: shop closed, delivery still on pre-order (per CLAUDE.md)
      // Represented separately.
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Tuesday",
        opens: "10:00",
        closes: "18:00",
        validFrom: "2026-01-01",
      },
    ],
    vatID: "CHE-363.951.581 MWST",
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
