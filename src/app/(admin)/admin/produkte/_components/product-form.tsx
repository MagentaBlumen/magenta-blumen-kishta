import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
  const selected = new Set(selectedCategoryIds);
  const selectedColours = new Set(selectedColourIds);

  return (
    <form action={action} className="space-y-10 max-w-3xl">
      {/* -------- Basics -------- */}
      <Section
        title="Grunddaten"
        description="Name und Beschreibung, wie sie im Shop erscheinen."
      >
        <Field label="Name" name="nameDe" required defaultValue={product?.nameDe} />
        <Field
          label="Slug"
          name="slug"
          defaultValue={product?.slug}
          placeholder="wird aus dem Namen generiert, wenn leer"
          help="URL-Teil, z.B. rosenstrauss-rot. Nur Kleinbuchstaben, Zahlen, Bindestriche."
          mono
        />
        <div className="space-y-2">
          <Label htmlFor="descriptionDe">Beschreibung</Label>
          <Textarea
            id="descriptionDe"
            name="descriptionDe"
            rows={4}
            defaultValue={product?.descriptionDe ?? ""}
          />
        </div>
      </Section>

      {/* -------- Pricing model + tax -------- */}
      <Section
        title="Preise & MWST"
        description="Wie der Preis gebildet wird und welcher Steuersatz gilt."
      >
        <SelectField
          label="Preismodus"
          name="pricingMode"
          defaultValue={product?.pricingMode ?? "variant"}
          options={[
            { value: "variant", label: "Varianten (verschiedene Grössen mit eigenem Preis)" },
            { value: "per_unit", label: "Pro Stück (z.B. Rosen)" },
            { value: "enquiry", label: "Nur Anfrage (Hochzeit, Trauer-Ceremonie, Gärtnerservice)" },
          ]}
        />
        <SelectField
          label="MWST-Satz"
          name="taxRateId"
          defaultValue={product?.taxRateId != null ? String(product.taxRateId) : ""}
          options={[
            { value: "", label: ". nicht gesetzt ." },
            ...taxRates.map((t) => ({
              value: String(t.id),
              label: `${t.nameDe} (${t.code})`,
            })),
          ]}
        />
      </Section>

      {/* -------- Variants -------- */}
      <Section
        title="Varianten"
        description="Grössen mit eigenem Preis. Bei «Pro Stück» nur eine Variante (Preis pro Stiel). Bei «Nur Anfrage» werden Varianten ignoriert - kein Verkauf möglich."
      >
        <VariantsEditor initial={initialVariants} />
      </Section>

      {/* -------- Categories -------- */}
      <Section
        title="Kategorien"
        description="Mehrfachauswahl. Sortiment beschreibt, WAS es ist; Anlass beschreibt, WARUM man es kauft."
      >
        <div className="grid gap-6 md:grid-cols-2">
          <CategoryGroup
            title="Sortiment"
            categories={ranges}
            selected={selected}
          />
          <CategoryGroup
            title="Anlass"
            categories={occasions}
            selected={selected}
          />
        </div>
      </Section>

      {/* -------- Colour facet -------- */}
      <Section
        title="Farbe"
        description="Facette, gehört zum Produkt (nicht zur Variante). «Bunt» hat keinen Hex-Wert - wird als Farbverlauf gezeigt."
      >
        <div className="flex flex-wrap gap-4">
          {colours.map((c) => (
            <ColourSwatch
              key={c.id}
              colour={c}
              defaultChecked={selectedColours.has(c.id)}
            />
          ))}
        </div>
      </Section>

      {/* -------- Availability flags -------- */}
      <Section title="Verfügbarkeit">
        <Checkbox
          name="isAvailable"
          defaultChecked={product?.isAvailable ?? true}
          label="Verfügbar"
          help="Nicht verfügbare Produkte werden im Shop ausgegraut angezeigt, nicht ausgeblendet."
        />
        <Checkbox
          name="isOnlineOrderable"
          defaultChecked={product?.isOnlineOrderable ?? true}
          label="Im Online-Shop bestellbar"
          help="Auschalten für Produkte, die nur im Laden verkauft werden."
        />
        <Checkbox
          name="isAddon"
          defaultChecked={product?.isAddon ?? false}
          label="Als Zusatzgeschenk anbieten"
          help="Erscheint im Zusatzgeschenke-Wähler beim Checkout (Vase, Schokolade, Karte, Ribbon)."
        />
        {product && (
          <Checkbox
            name="isArchived"
            defaultChecked={product.isArchived}
            label="Archiviert"
            help="Nicht mehr im Shop sichtbar. Vergangene Bestellungen bleiben unverändert."
          />
        )}
      </Section>

      {/* -------- Misc -------- */}
      <Section title="Sonstiges">
        <Field
          label="Sortierung"
          name="sortOrder"
          type="number"
          defaultValue={String(product?.sortOrder ?? 0)}
          help="Kleinere Zahlen erscheinen zuerst."
        />
        <Field
          label="Vorlaufzeit (Tage)"
          name="leadTimeDays"
          type="number"
          defaultValue={String(product?.leadTimeDays ?? 0)}
          help="Zusätzliche Tage Vorlaufzeit über die Standard-3-Stunden-Regel hinaus."
        />
      </Section>

      {/* -------- Buttons -------- */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Link
          href="/admin/produkte"
          className={buttonVariants({ variant: "outline" })}
        >
          Abbrechen
        </Link>
        <button type="submit" className={buttonVariants()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

/* ================= helper components ================= */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
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
  help,
  type = "text",
  required = false,
  mono = false,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  help?: string;
  type?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className={mono ? "font-mono text-sm" : undefined}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
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
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

function Checkbox({
  name,
  defaultChecked,
  label,
  help,
}: {
  name: string;
  defaultChecked?: boolean;
  label: string;
  help?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-input accent-primary"
      />
      <div className="space-y-1">
        <Label htmlFor={name} className="font-normal cursor-pointer">
          {label}
        </Label>
        {help && <p className="text-xs text-muted-foreground">{help}</p>}
      </div>
    </div>
  );
}

function CategoryGroup({
  title,
  categories,
  selected,
}: {
  title: string;
  categories: Category[];
  selected: Set<number>;
}) {
  return (
    <div>
      <h3 className="text-sm font-medium mb-2">{title}</h3>
      <div className="space-y-1.5">
        {categories.map((c) => (
          <label
            key={c.id}
            className="flex items-center gap-2 text-sm cursor-pointer"
          >
            <input
              type="checkbox"
              name="categoryIds"
              value={c.id}
              defaultChecked={selected.has(c.id)}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            {c.nameDe}
          </label>
        ))}
      </div>
    </div>
  );
}

// Pure SSR swatch - the "peer" utility styles the swatch based on the
// (visually hidden) checkbox's checked state. No client JS needed.
function ColourSwatch({
  colour,
  defaultChecked,
}: {
  colour: ColourValue;
  defaultChecked: boolean;
}) {
  const background =
    colour.hex ??
    // 'bunt' - no single hex, render a rainbow conic gradient
    "conic-gradient(from 0deg, #F5F0E6, #E8A0BF, #C1272D, #E8853B, #F2C744, #6A8F4F, #6B5B95, #E4D9E8, #F5F0E6)";

  return (
    <label className="flex flex-col items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        name="colourIds"
        value={colour.id}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="h-12 w-12 rounded-full border border-neutral-300 ring-2 ring-transparent ring-offset-2 ring-offset-background peer-checked:ring-primary transition-shadow"
        style={{ background }}
      />
      <span className="text-xs text-muted-foreground peer-checked:text-foreground peer-checked:font-medium">
        {colour.nameDe}
      </span>
    </label>
  );
}
