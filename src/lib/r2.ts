import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";

/**
 * R2 client for the IMAGES bucket.
 *
 * Product images are PUBLIC (any browser hitting the storefront needs
 * them). So the bucket has r2.dev public access enabled and each
 * uploaded object is fetched via R2_IMAGES_PUBLIC_URL, not via a
 * signed S3 URL.
 *
 * Uploads still use the S3 API with a scoped credential from
 * R2_IMAGES_ACCESS_KEY_ID + R2_IMAGES_SECRET_ACCESS_KEY. See
 * docs/deploy.md and .env.production.example for setup.
 *
 * Backups live in a separate bucket (magenta-blumen-backups) with its
 * own credential. Keep them separate - blast radius, rotation.
 */

let cached: S3Client | null = null;

function client(): S3Client {
  if (cached) return cached;

  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_IMAGES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_IMAGES_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 image credentials missing (R2_ENDPOINT, R2_IMAGES_ACCESS_KEY_ID, R2_IMAGES_SECRET_ACCESS_KEY)",
    );
  }

  cached = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cached;
}

function bucket(): string {
  const b = process.env.R2_IMAGES_BUCKET;
  if (!b) throw new Error("R2_IMAGES_BUCKET not set");
  return b;
}

function publicBase(): string {
  const url = process.env.R2_IMAGES_PUBLIC_URL;
  if (!url) throw new Error("R2_IMAGES_PUBLIC_URL not set");
  // strip any trailing slash so callers can safely concatenate
  return url.replace(/\/+$/, "");
}

/**
 * Upload one object to R2. Returns the public URL where it will be
 * served from (no HEAD request; R2 confirms via Put's 200).
 */
export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<string> {
  await client().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      // Cache aggressively - filenames include a random hash so URLs are
      // immutable per-image and we control invalidation by deleting the
      // old key when replacing.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return `${publicBase()}/${key}`;
}

/** Delete one object. Silent-succeeds if the key doesn't exist. */
export async function deleteObject(key: string): Promise<void> {
  await client().send(
    new DeleteObjectCommand({ Bucket: bucket(), Key: key }),
  );
}

/** Delete many objects in one round-trip. */
export async function deleteObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await client().send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: keys.map((k) => ({ Key: k })) },
    }),
  );
}

/**
 * Derive an object key from a public URL that we uploaded ourselves.
 * Used at delete time to convert a stored `product_image.url` back
 * into the R2 key. Returns null if the URL doesn't belong to our
 * public base (e.g. legacy external URL).
 */
export function keyFromPublicUrl(url: string): string | null {
  const base = publicBase();
  if (!url.startsWith(base + "/")) return null;
  return url.slice(base.length + 1);
}
