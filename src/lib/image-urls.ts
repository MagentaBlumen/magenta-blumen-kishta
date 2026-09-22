/**
 * The DB stores the LARGE derivative's URL in product_image.url.
 * The THUMB derivative lives at the same object-key pattern with a
 * suffix swap:
 *
 *   .../products/<id>/<hash>-large.jpg   (large  - JPG q85)
 *   .../products/<id>/<hash>-thumb.webp  (thumb  - WebP q80)
 *
 * Storefront grids should use the thumb; product-detail hero should
 * use the large.
 *
 * If the URL doesn't match our pattern (legacy import, external CDN),
 * fall back to the original URL - better a slightly-large image than
 * a broken one.
 */

export function largeUrl(storedUrl: string): string {
  return storedUrl;
}

export function thumbUrl(storedUrl: string): string {
  if (storedUrl.endsWith("-large.jpg")) {
    return storedUrl.slice(0, -"-large.jpg".length) + "-thumb.webp";
  }
  return storedUrl;
}
