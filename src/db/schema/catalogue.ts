import { sql } from 'drizzle-orm';
import {
  pgTable, bigserial, bigint, serial, integer, text, boolean, numeric, date, char,
  timestamp, primaryKey, uniqueIndex, index, check,
} from 'drizzle-orm/pg-core';
import { pricingMode, slotType, categoryKind } from './enums';
import { taxRate } from './settings';

/* ------------------------------------------------------------------ */
/* Categories                                                          */
/* ------------------------------------------------------------------ */

export const category = pgTable(
  'category',
  {
    id: serial('id').primaryKey(),
    slug: text('slug').notNull().unique(),
    nameDe: text('name_de').notNull(),
    kind: categoryKind('kind').notNull().default('range'),
    sortOrder: integer('sort_order').notNull().default(0),

    /** false for Hochzeit / Evente / Gaertnerservice -> enquiry form only */
    isOrderableOnline: boolean('is_orderable_online').notNull().default(true),

    /**
     * Seasonal groups appear and disappear automatically.
     *
     * WARNING: do NOT hardcode Ostern or Muttertag. Easter is a movable feast
     * and shifts by over a month year to year; Swiss Mother's Day is the
     * second Sunday in May. These dates are editable so she sets them each
     * January. An AI will happily write active_from = '2027-03-28' and it
     * will be silently wrong the following year.
     */
    isSeasonal: boolean('is_seasonal').notNull().default(false),
    activeFrom: date('active_from'),
    activeTo: date('active_to'),
  },
  (t) => [index('category_kind_sort_idx').on(t.kind, t.sortOrder)],
);

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export const product = pgTable(
  'product',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    slug: text('slug').notNull().unique(),
    nameDe: text('name_de').notNull(),
    descriptionDe: text('description_de'),

    pricingMode: pricingMode('pricing_mode').notNull().default('variant'),
    slotType: slotType('slot_type').notNull().default('run'),

    /** FK, never a literal rate. Swiss rates have changed twice recently. */
    taxRateId: integer('tax_rate_id').references(() => taxRate.id),

    /**
     * Boolean only. There is NO integer stock anywhere in this schema.
     * Q35: "available / not available". Q39: "all flowers are there every day".
     * Sold out renders GREYED OUT, not hidden (Q37).
     */
    isAvailable: boolean('is_available').notNull().default(true),

    isOnlineOrderable: boolean('is_online_orderable').notNull().default(true),

    /**
     * Vase, chocolate, ribbon, card.
     *
     * This flag controls whether the product appears in the ADD-ON PICKER on a
     * bouquet page. It does NOT restrict standalone purchase - an add-on can
     * also be bought on its own, in which case its order line has a NULL
     * parent_line_id.
     */
    isAddon: boolean('is_addon').notNull().default(false),

    leadTimeDays: integer('lead_time_days').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),

    /**
     * Archived products vanish from the admin list and the storefront but the
     * row survives, because order_line.product_id still points at it.
     * NEVER hard-delete a product that has ever been ordered - that is what
     * this column exists to avoid.
     */
    isArchived: boolean('is_archived').notNull().default(false),

    /**
     * SEO. Organic search IS the acquisition channel for a local florist -
     * "Blumen Neuenhof", "Blumen liefern Baden". Leave NULL to fall back to
     * name_de and a truncated description_de.
     */
    metaTitleDe: text('meta_title_de'),
    metaDescriptionDe: text('meta_description_de'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('product_available_idx').on(t.isAvailable, t.isOnlineOrderable, t.isArchived),
    index('product_sort_idx').on(t.sortOrder),
  ],
);

export const productVariant = pgTable(
  'product_variant',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),

    /** 'Klein' | 'Mittel' | 'Gross' | NULL. Labels are shared vocabulary. */
    sizeLabelDe: text('size_label_de'),

    /**
     * PRICES live here, per product - not on a shared size table.
     * Q18: "some bouquets cost more, some flowers are smaller".
     *
     * For pricing_mode = 'per_unit' this is the price of ONE STEM.
     */
    priceGross: numeric('price_gross', { precision: 10, scale: 2 }).notNull(),
    salePriceGross: numeric('sale_price_gross', { precision: 10, scale: 2 }),

    isAvailable: boolean('is_available').notNull().default(true),

    /** per_unit only: how many stems may be ordered */
    minQuantity: integer('min_quantity').notNull().default(1),
    maxQuantity: integer('max_quantity'),

    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('variant_product_idx').on(t.productId, t.sortOrder),
    check('variant_price_positive', sql`${t.priceGross} > 0`),
    check(
      'variant_quantity_range',
      sql`${t.maxQuantity} IS NULL OR ${t.maxQuantity} >= ${t.minQuantity}`,
    ),
  ],
);

export const productImage = pgTable(
  'product_image',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),

    /**
     * NULL = applies to the whole product.
     * Set = this photo belongs to one size. The Klein bouquet is physically
     * smaller than the Gross one, and showing the same photo for both is how
     * you get "I paid 40 and expected the picture" complaints.
     */
    variantId: bigint('variant_id', { mode: 'number' }).references(
      () => productVariant.id,
      { onDelete: 'set null' },
    ),

    /** Cloudflare R2 URL */
    url: text('url').notNull(),
    altDe: text('alt_de'),

    /**
     * Intrinsic dimensions, captured by sharp at upload.
     * Without these the browser cannot reserve space and every product page
     * shifts as images load. Cumulative Layout Shift is a ranking factor, so
     * this is an SEO column as much as a UX one.
     */
    width: integer('width'),
    height: integer('height'),

    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('image_product_idx').on(t.productId, t.sortOrder)],
);

/** Many-to-many. Q24: a red rose bouquet is under Rosen AND under Valentinstag. */
export const productCategory = pgTable(
  'product_category',
  {
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    categoryId: integer('category_id')
      .notNull()
      .references(() => category.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categoryId] }),
    index('product_category_category_idx').on(t.categoryId),
  ],
);

/* ------------------------------------------------------------------ */
/* Attributes / facets                                                 */
/* ------------------------------------------------------------------ */

/**
 * Colour filtering (Q25, Q126). This is a FACET system, not subcategories.
 * Colour belongs to the PRODUCT, not the variant - she sets the colour of the
 * flower, and a Klein and a Gross bouquet of the same product are the same
 * colour.
 */
export const attribute = pgTable('attribute', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(), // 'colour'
  nameDe: text('name_de').notNull(), // 'Farbe'
  sortOrder: integer('sort_order').notNull().default(0),
});

export const attributeValue = pgTable(
  'attribute_value',
  {
    id: serial('id').primaryKey(),
    attributeId: integer('attribute_id')
      .notNull()
      .references(() => attribute.id, { onDelete: 'cascade' }),
    value: text('value').notNull(), // 'rot'
    nameDe: text('name_de').notNull(), // 'Rot'
    /** swatch colour. NULL for 'bunt' - render a gradient instead. */
    hex: char('hex', { length: 7 }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [uniqueIndex('attribute_value_unique').on(t.attributeId, t.value)],
);

export const productAttributeValue = pgTable(
  'product_attribute_value',
  {
    productId: bigint('product_id', { mode: 'number' })
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
    attributeValueId: integer('attribute_value_id')
      .notNull()
      .references(() => attributeValue.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.attributeValueId] }),
    index('pav_value_idx').on(t.attributeValueId),
  ],
);
