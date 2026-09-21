import sharp from "sharp";

/**
 * Image processing for product photos.
 *
 * Two derivatives per upload:
 *   - "large": max 2048px wide, JPEG q85. Product-page hero.
 *   - "thumb": 400px wide, WebP q80. Product-card grid.
 *
 * Rationale for two sizes rather than serving one and letting Next.js
 * Image resize: we don't want to run libvips inside a request handler
 * every time an image loads. Pre-generated derivatives at upload keep
 * request latency predictable and R2 egress cheap.
 *
 * The originals we get from Sandra will be phone camera photos
 * (3000-4000px, 3-5 MB). "Large" alone drops these to ~500 KB.
 */

const LARGE_MAX_WIDTH = 2048;
const THUMB_WIDTH = 400;

export type ProcessedImage = {
  large: Buffer;
  largeContentType: "image/jpeg";
  thumb: Buffer;
  thumbContentType: "image/webp";
  /** Width of the largest derivative (used for the DB `width` column). */
  width: number;
  height: number;
};

/** Return true if the MIME type looks like an image we can process. */
export function isSupportedImageType(mime: string): boolean {
  return (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    mime === "image/avif"
  );
}

/**
 * Read an uploaded file into memory and produce two derivatives.
 *
 * `sharp` streams internally so even a large source doesn't spike RSS
 * dangerously - but we do hold three buffers (source + two outputs)
 * simultaneously. At 20 MB source that's fine on a 4 GB box.
 */
export async function processImage(source: Buffer): Promise<ProcessedImage> {
  // rotate() honours EXIF orientation so portrait phone shots don't
  // land sideways after re-encode.
  const base = sharp(source).rotate();

  const meta = await base.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Bild konnte nicht gelesen werden (keine Metadaten)");
  }

  const large = await base
    .clone()
    .resize({
      width: LARGE_MAX_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();

  const thumb = await base
    .clone()
    .resize({
      width: THUMB_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .webp({ quality: 80 })
    .toBuffer();

  // Report the DIMENSIONS AS UPLOADED (post-rotate), capped at the
  // large-max width so what we store matches what the storefront
  // renders. Prevents CLS: the browser knows how much space to reserve.
  const largeMeta = await sharp(large).metadata();

  return {
    large,
    largeContentType: "image/jpeg",
    thumb,
    thumbContentType: "image/webp",
    width: largeMeta.width ?? meta.width,
    height: largeMeta.height ?? meta.height,
  };
}

/** Random alphanumeric key segment for uploaded objects. */
export function randomKeySegment(len = 10): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}
