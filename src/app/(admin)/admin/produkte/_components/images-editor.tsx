"use client";

import { useRef, useState, useTransition } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteProductImage,
  moveProductImage,
  updateProductImageMeta,
  uploadProductImage,
} from "../[id]/_actions/images";

export type ExistingImage = {
  id: number;
  url: string;
  altDe: string | null;
  variantId: number | null;
  width: number | null;
  height: number | null;
};

type VariantOption = {
  id: number;
  label: string; // "Klein . 35.00 CHF"
};

type Props = {
  productId: number;
  images: ExistingImage[];
  variants: VariantOption[];
};

/**
 * Per-image editor. Uploads persist IMMEDIATELY on file select (not
 * on form submit) - so a crashed browser doesn't lose them. Alt text
 * and variant assignment save per-row via their own form.
 */
export function ImagesEditor({ productId, images, variants }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    startTransition(async () => {
      try {
        // Sequential uploads. Parallel would be faster but sharp +
        // network + R2 puts real load on the server; one at a time is
        // predictable and keeps memory bounded.
        for (const file of Array.from(files)) {
          const fd = new FormData();
          fd.append("file", file);
          await uploadProductImage(productId, fd);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload fehlgeschlagen");
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            JPEG, PNG, WebP oder AVIF. Max 20 MB pro Bild. Der Upload beginnt
            sofort nach der Auswahl.
          </p>
          {error && (
            <p className="text-sm text-destructive mt-2">{error}</p>
          )}
        </div>
        <label className={buttonVariants({ variant: "outline", size: "sm" })}>
          {pending ? "Wird hochgeladen..." : "Bilder hinzufügen"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
            disabled={pending}
          />
        </label>
      </div>

      {images.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Noch keine Bilder.
        </div>
      ) : (
        <div className="space-y-3">
          {images.map((img, idx) => (
            <ImageRow
              key={img.id}
              image={img}
              variants={variants}
              isFirst={idx === 0}
              isLast={idx === images.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ImageRow({
  image,
  variants,
  isFirst,
  isLast,
}: {
  image: ExistingImage;
  variants: VariantOption[];
  isFirst: boolean;
  isLast: boolean;
}) {
  const [saving, startSaving] = useTransition();
  const [moving, startMoving] = useTransition();
  const [deleting, startDeleting] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  const onMetaChange = (formData: FormData) => {
    setStatus(null);
    startSaving(async () => {
      try {
        await updateProductImageMeta(image.id, formData);
        setStatus("Gespeichert");
      } catch (e) {
        setStatus(e instanceof Error ? e.message : "Fehler");
      }
    });
  };

  const onMove = (direction: "up" | "down") => {
    startMoving(async () => {
      await moveProductImage(image.id, direction);
    });
  };

  const onDelete = () => {
    if (!confirm("Bild wirklich löschen?")) return;
    startDeleting(async () => {
      await deleteProductImage(image.id);
    });
  };

  return (
    <div className="rounded-lg border p-4 bg-card grid gap-4 md:grid-cols-[120px_1fr_auto]">
      {/* Thumbnail preview */}
      <div className="relative w-[120px] h-[120px] rounded-md overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image.url}
          alt={image.altDe ?? ""}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Meta form */}
      <form action={onMetaChange} className="space-y-2">
        <div className="space-y-1.5">
          <Label htmlFor={`alt-${image.id}`} className="text-xs">
            Alt-Text (SEO / Barrierefreiheit)
          </Label>
          <Input
            id={`alt-${image.id}`}
            name="altDe"
            defaultValue={image.altDe ?? ""}
            placeholder="z.B. Roter Rosenstrauss auf Holztisch"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`variant-${image.id}`} className="text-xs">
            Variante
          </Label>
          <select
            id={`variant-${image.id}`}
            name="variantId"
            defaultValue={image.variantId != null ? String(image.variantId) : ""}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
          >
            <option value="">. ganzes Produkt .</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            className={buttonVariants({ variant: "outline", size: "sm" })}
            disabled={saving}
          >
            {saving ? "..." : "Speichern"}
          </button>
          {status && (
            <span className="text-xs text-muted-foreground">{status}</span>
          )}
        </div>
      </form>

      {/* Sort + delete controls */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onMove("up")}
          disabled={isFirst || moving}
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          title="Nach oben"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove("down")}
          disabled={isLast || moving}
          className={buttonVariants({ variant: "outline", size: "icon-sm" })}
          title="Nach unten"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className={buttonVariants({ variant: "destructive", size: "sm" })}
          title="Bild löschen"
        >
          {deleting ? "..." : "Löschen"}
        </button>
      </div>
    </div>
  );
}
