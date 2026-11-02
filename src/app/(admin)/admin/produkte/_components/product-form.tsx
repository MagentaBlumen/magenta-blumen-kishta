import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VariantsEditor, type VariantRow } from "./variants-editor";

type Category = {
  id: number;
  slug: string;
  nameDe: string;
  kind: "range" | "occasion";
};

type TaxRate = {
  id: number;
  code: string;
  nameDe: string;
};

type ColourValue = {
  id: number;
  value: string;
  nameDe: string;
  hex: string | null;
};

type ProductInitial = {
  id: number;
  slug: string;
  nameDe: string;
  descriptionDe: string | null;
  pricingMode: "variant" | "per_unit" | "enquiry";
  taxRateId: number | null;
  isAvailable: boolean;
  isOnlineOrderable: boolean;
  isAddon: boolean;
  isArchived: boolean;
  leadTimeDays: number;
  sortOrder: number;
};

type Props = {
  categories: Category[];
  taxRates: TaxRate[];
  colours: ColourValue[];
  product?: ProductInitial;
  selectedCategoryIds?: number[];
  selectedColourIds?: number[];
  initialVariants?: VariantRow[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
};

/**
 * Product form. One screen, every control in sight. The form field
 * NAMES map 1:1 to what the server action parses — don't rename
 * without touching actions.ts.
 *
 * Design intent:
 *   - Short labels, no paragraph-length descriptions
 *   - Pricing mode is a 3-card radio, not a <select> with 60-char labels
 *   - Categories + colours are visual pills / swatches, not lists
 *   - Flags are compact toggle rows
 *   - Advanced fields (sortOrder, leadTimeDays) are collapsed by default
 *   - Sticky action bar at the bottom so Save is always reachable
 */
export function ProductForm({
  categories,
  taxRates,
  colours,
  product,
  selectedCategoryIds = [],
  selectedColourIds = [],
  initialVariants = [],
  action,
  submitLabel,
}: Props) {
  const ranges = categories.filter((c) => c.kind === "range");
  const occasions = categories.filter((c) => c.kind === "occasion");
  const selectedCats = new Set(selectedCategoryIds);
  const selectedColours = new Set(selectedColourIds);
  const pricingMode = product?.pricingMode ?? "variant";

  return (
    <form action={action} className="pb-24 space-y-8 max-w-3xl">
      {/* Basics */}
      <Card title="Grunddaten">
        <Field label="Name" name="nameDe" required defaultValue={product?.nameDe} />
        <Field
          label="Slug"
          name="slug"
          defaultValue={product?.slug}
          placeholder="wird aus Name generiert"
          mono
        />
        <div className="space-y-1.5">
          <Label htmlFor="descriptionDe" className="text-xs tracking-[0.1em] uppercase text-muted-foreground font-medium">
            Beschreibung
          </Label>
          <Textarea
            id="descriptionDe"
            name="descriptionDe"
            rows={4}
            defaultValue={product?.descriptionDe ?? ""}
          />
        </div>
      </Card>

      {/* Pricing + tax */}
      <Card title="Preismodell">
        <PricingPicker defaultValue={pricingMode} />
        <SelectField
          label="MWST-Satz"
          name="taxRateId"
          defaultValue={product?.taxRateId != null ? String(product.taxRateId) : ""}
          options={[
            { value: "", label: "— nicht gesetzt —" },
            ...taxRates.map((t) => ({
              value: String(t.id),
              label: `${t.nameDe} (${t.code})`,
            })),
          ]}
        />
      </Card>

      {/* Variants */}
      <Card
        title="Varianten"
        hint="Pro Stück: eine Zeile. Anfrage: keine Varianten."
      >
        <VariantsEditor initial={initialVariants} />
      </Card>

      {/* Categories */}
      <Card title="Kategorien">
        <PillGroup
          label="Sortiment"
          name="categoryIds"
          options={ranges}
          selected={selectedCats}
        />
        <PillGroup
          label="Anlass"
          name="categoryIds"
          options={occasions}
          selected={selectedCats}
        />
      </Card>

      {/* Colours */}
      <Card title="Farben">
        <div className="flex flex-wrap gap-3">
          {colours.map((c) => (
            <ColourSwatch
              key={c.id}
              colour={c}
              defaultChecked={selectedColours.has(c.id)}
            />
          ))}
        </div>
      </Card>

      {/* Flags */}
      <Card title="Verfügbarkeit">
        <div className="grid gap-3 sm:grid-cols-2">
          <Toggle
            name="isAvailable"
            defaultChecked={product?.isAvailable ?? true}
            label="Verfügbar"
          />
          <Toggle
            name="isOnlineOrderable"
            defaultChecked={product?.isOnlineOrderable ?? true}
            label="Online bestellbar"
          />
          <Toggle
            name="isAddon"
            defaultChecked={product?.isAddon ?? false}
            label="Zusatzgeschenk"
          />
          {product && (
            <Toggle
              name="isArchived"
              defaultChecked={product.isArchived}
              label="Archiviert"
            />
          )}
        </div>
      </Card>

      {/* Advanced (collapsed) */}
      <details className="rounded-lg border border-mist bg-card group">
        <summary className="cursor-pointer list-none px-5 py-3 text-sm font-medium flex items-center justify-between hover:text-rose transition-colors">
          <span>Erweitert</span>
          <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">
            ▾
          </span>
        </summary>
        <div className="px-5 pb-5 pt-1 grid gap-4 sm:grid-cols-2">
          <Field
            label="Sortierung"
            name="sortOrder"
            type="number"
            defaultValue={String(product?.sortOrder ?? 0)}
            hint="Kleinere Zahl zuerst."
          />
          <Field
            label="Vorlaufzeit (Tage)"
            name="leadTimeDays"
            type="number"
            defaultValue={String(product?.leadTimeDays ?? 0)}
            hint="Zusätzlich zur 3-Stunden-Regel."
          />
        </div>
      </details>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-mist bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-end gap-2">
          <Link
            href="/admin/produkte"
            className="inline-flex items-center px-4 py-2 text-xs tracking-[0.1em] uppercase font-medium border border-input bg-background hover:bg-muted rounded-md transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            className="group inline-flex items-center gap-2 px-5 py-2 text-xs tracking-[0.14em] uppercase font-medium bg-foreground text-background hover:bg-rose active:translate-y-px transition-all duration-200 rounded-md"
          >
            {submitLabel}
            <span className="transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}

/* ================= helpers ================= */

function Card({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-mist bg-card p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xs tracking-[0.14em] uppercase font-medium text-muted-foreground">
          {title}
        </h2>
        {hint && (
          <span className="text-[0.7rem] text-muted-foreground/70">
            {hint}
          </span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  placeholder,
  hint,
  type = "text",
  required = false,
  mono = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  hint?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={name}
        className="text-xs tracking-[0.1em] uppercase text-muted-foreground font-medium"
      >
        {label}
        {required && <span className="text-rose ml-1">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className={`focus:ring-2 focus:ring-rose/30 focus:border-rose ${mono ? "font-mono text-sm" : ""}`}
      />
      {hint && <p className="text-[0.7rem] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={name}
        className="text-xs tracking-[0.1em] uppercase text-muted-foreground font-medium"
      >
        {label}
      </Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-rose/30 focus:border-rose transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Three-card radio picker. The hidden radio inputs still submit a
 * standard `pricingMode` value, so the server action parser is unchanged.
 */
function PricingPicker({
  defaultValue,
}: {
  defaultValue: "variant" | "per_unit" | "enquiry";
}) {
  const opts: {
    value: "variant" | "per_unit" | "enquiry";
    label: string;
    sub: string;
  }[] = [
    { value: "variant", label: "Varianten", sub: "Grössen mit eigenem Preis" },
    { value: "per_unit", label: "Pro Stück", sub: "z. B. Rosen pro Stiel" },
    { value: "enquiry", label: "Anfrage", sub: "kein Online-Verkauf" },
  ];
  return (
    <div>
      <Label className="text-xs tracking-[0.1em] uppercase text-muted-foreground font-medium">
        Modus
      </Label>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <label
            key={o.value}
            className="relative cursor-pointer rounded-md border border-input bg-background p-3 text-center hover:border-foreground/50 has-[:checked]:border-rose has-[:checked]:bg-rose/5 has-[:checked]:ring-2 has-[:checked]:ring-rose/20 transition-all"
          >
            <input
              type="radio"
              name="pricingMode"
              value={o.value}
              defaultChecked={defaultValue === o.value}
              className="sr-only"
            />
            <div className="text-sm font-medium">{o.label}</div>
            <div className="text-[0.68rem] text-muted-foreground mt-0.5">
              {o.sub}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * Compact toggle-switch style for boolean flags. Native checkbox under
 * the hood (name/value flow unchanged); the visual is just CSS peer
 * styling on the sibling span.
 */
function Toggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none p-2 rounded-md hover:bg-muted/50 transition-colors">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="flex-shrink-0 relative w-9 h-5 rounded-full bg-muted peer-checked:bg-rose transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-background after:transition-transform peer-checked:after:translate-x-4"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function PillGroup({
  label,
  name,
  options,
  selected,
}: {
  label: string;
  name: string;
  options: Category[];
  selected: Set<number>;
}) {
  return (
    <div>
      <Label className="text-xs tracking-[0.1em] uppercase text-muted-foreground font-medium">
        {label}
      </Label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {options.map((c) => (
          <label
            key={c.id}
            className="cursor-pointer inline-flex items-center text-xs px-3 py-1.5 rounded-full border border-input bg-background hover:border-foreground/50 has-[:checked]:bg-foreground has-[:checked]:text-background has-[:checked]:border-foreground transition-all select-none"
          >
            <input
              type="checkbox"
              name={name}
              value={c.id}
              defaultChecked={selected.has(c.id)}
              className="sr-only"
            />
            {c.nameDe}
          </label>
        ))}
      </div>
    </div>
  );
}

function ColourSwatch({
  colour,
  defaultChecked,
}: {
  colour: ColourValue;
  defaultChecked: boolean;
}) {
  const background =
    colour.hex ??
    "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)";

  return (
    <label
      className="flex flex-col items-center gap-1 cursor-pointer group"
      title={colour.nameDe}
    >
      <input
        type="checkbox"
        name="colourIds"
        value={colour.id}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="h-10 w-10 rounded-full border border-neutral-300 ring-2 ring-transparent ring-offset-2 ring-offset-background peer-checked:ring-rose transition-shadow"
        style={{ background }}
      />
      <span className="text-[0.65rem] text-muted-foreground peer-checked:text-foreground peer-checked:font-medium">
        {colour.nameDe}
      </span>
    </label>
  );
}
