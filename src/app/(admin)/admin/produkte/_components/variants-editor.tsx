"use client";

import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Nested add/edit/remove for product_variant rows.
 *
 * Keeps state client-side, serializes the whole array as JSON into a
 * single hidden field (`variantsJson`) that the server action parses.
 *
 * Rules the server enforces (not this component):
 *   - price_gross > 0
 *   - max_quantity NULL or >= min_quantity
 *   - deleting a variant that has order_line rows is refused
 *     (TODO once orders exist; today the schema allows it)
 *
 * The `id` field distinguishes new rows (id === null) from existing
 * rows (id === number). Server uses this to decide insert vs update.
 * Rows present in the initial payload but missing from the submitted
 * payload get deleted.
 */

export type VariantRow = {
  id: number | null;
  sizeLabelDe: string;
  priceGross: string;        // numeric(10,2) round-trips as string in JS
  salePriceGross: string;    // "" when unset
  isAvailable: boolean;
  minQuantity: string;       // number-input, kept as string for the field
  maxQuantity: string;       // "" for null
  sortOrder: string;
};

function emptyRow(): VariantRow {
  return {
    id: null,
    sizeLabelDe: "",
    priceGross: "",
    salePriceGross: "",
    isAvailable: true,
    minQuantity: "1",
    maxQuantity: "",
    sortOrder: "0",
  };
}

export function VariantsEditor({ initial }: { initial: VariantRow[] }) {
  const [rows, setRows] = useState<VariantRow[]>(
    initial.length ? initial : [emptyRow()],
  );

  const update = (idx: number, patch: Partial<VariantRow>) => {
    setRows((cur) => cur.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const remove = (idx: number) => {
    setRows((cur) => cur.filter((_, i) => i !== idx));
  };

  const add = () => {
    setRows((cur) => [
      ...cur,
      { ...emptyRow(), sortOrder: String(cur.length) },
    ]);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={idx}
            className="rounded-lg border p-4 space-y-3 bg-card"
          >
            <div className="grid gap-3 md:grid-cols-[2fr_1fr_1fr] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`variant-${idx}-size`}>Grösse / Label</Label>
                <Input
                  id={`variant-${idx}-size`}
                  value={row.sizeLabelDe}
                  onChange={(e) => update(idx, { sizeLabelDe: e.target.value })}
                  placeholder="z.B. Klein, Mittel, Gross — leer für per_unit"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variant-${idx}-price`}>
                  Preis (CHF) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id={`variant-${idx}-price`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={row.priceGross}
                  onChange={(e) => update(idx, { priceGross: e.target.value })}
                  placeholder="45.00"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variant-${idx}-sale`}>Aktionspreis (CHF)</Label>
                <Input
                  id={`variant-${idx}-sale`}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={row.salePriceGross}
                  onChange={(e) =>
                    update(idx, { salePriceGross: e.target.value })
                  }
                  placeholder="optional"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
              <div className="space-y-1.5">
                <Label htmlFor={`variant-${idx}-min`}>Min. Menge</Label>
                <Input
                  id={`variant-${idx}-min`}
                  type="number"
                  min="1"
                  value={row.minQuantity}
                  onChange={(e) => update(idx, { minQuantity: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variant-${idx}-max`}>Max. Menge</Label>
                <Input
                  id={`variant-${idx}-max`}
                  type="number"
                  min="1"
                  value={row.maxQuantity}
                  onChange={(e) => update(idx, { maxQuantity: e.target.value })}
                  placeholder="unbegrenzt"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`variant-${idx}-sort`}>Sortierung</Label>
                <Input
                  id={`variant-${idx}-sort`}
                  type="number"
                  value={row.sortOrder}
                  onChange={(e) => update(idx, { sortOrder: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className={buttonVariants({
                  variant: "outline",
                  size: "sm",
                })}
                title={
                  row.id != null
                    ? "Diese Variante wird beim Speichern gelöscht"
                    : "Zeile entfernen"
                }
              >
                Entfernen
              </button>
            </div>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={row.isAvailable}
                onChange={(e) =>
                  update(idx, { isAvailable: e.target.checked })
                }
                className="h-4 w-4 rounded border-input accent-primary"
              />
              Verfügbar
            </label>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={add}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        + Variante hinzufügen
      </button>

      {/* Server action reads this single field, not the per-input names. */}
      <input type="hidden" name="variantsJson" value={JSON.stringify(rows)} />
    </div>
  );
}
