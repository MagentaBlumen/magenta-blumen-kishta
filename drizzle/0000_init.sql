CREATE TYPE "public"."category_kind" AS ENUM('range', 'occasion');--> statement-breakpoint
CREATE TYPE "public"."delivery_context" AS ENUM('residential', 'business', 'hospital', 'funeral');--> statement-breakpoint
CREATE TYPE "public"."delivery_method" AS ENUM('own_van', 'post', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percent', 'fixed', 'free_delivery');--> statement-breakpoint
CREATE TYPE "public"."enquiry_type" AS ENUM('wedding', 'event', 'funeral', 'gardening');--> statement-breakpoint
CREATE TYPE "public"."fulfilment_type" AS ENUM('run', 'timed', 'pickup', 'post');--> statement-breakpoint
CREATE TYPE "public"."notify_channel" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "public"."notify_recipient" AS ENUM('buyer', 'shop', 'driver');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('new', 'confirmed', 'in_production', 'ready', 'out_for_delivery', 'delivered', 'delivery_failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'twint', 'cash', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."pricing_mode" AS ENUM('variant', 'per_unit', 'enquiry');--> statement-breakpoint
CREATE TYPE "public"."slot_type" AS ENUM('run', 'timed');--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description_de" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_rate" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name_de" text NOT NULL,
	"rate" numeric(5, 4),
	CONSTRAINT "tax_rate_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "attribute" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name_de" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "attribute_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "attribute_value" (
	"id" serial PRIMARY KEY NOT NULL,
	"attribute_id" integer NOT NULL,
	"value" text NOT NULL,
	"name_de" text NOT NULL,
	"hex" char(7),
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_de" text NOT NULL,
	"kind" "category_kind" DEFAULT 'range' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_orderable_online" boolean DEFAULT true NOT NULL,
	"is_seasonal" boolean DEFAULT false NOT NULL,
	"active_from" date,
	"active_to" date,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name_de" text NOT NULL,
	"description_de" text,
	"pricing_mode" "pricing_mode" DEFAULT 'variant' NOT NULL,
	"slot_type" "slot_type" DEFAULT 'run' NOT NULL,
	"tax_rate_id" integer,
	"is_available" boolean DEFAULT true NOT NULL,
	"is_online_orderable" boolean DEFAULT true NOT NULL,
	"is_addon" boolean DEFAULT false NOT NULL,
	"lead_time_days" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"meta_title_de" text,
	"meta_description_de" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_attribute_value" (
	"product_id" bigint NOT NULL,
	"attribute_value_id" integer NOT NULL,
	CONSTRAINT "product_attribute_value_product_id_attribute_value_id_pk" PRIMARY KEY("product_id","attribute_value_id")
);
--> statement-breakpoint
CREATE TABLE "product_category" (
	"product_id" bigint NOT NULL,
	"category_id" integer NOT NULL,
	CONSTRAINT "product_category_product_id_category_id_pk" PRIMARY KEY("product_id","category_id")
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"variant_id" bigint,
	"url" text NOT NULL,
	"alt_de" text,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"product_id" bigint NOT NULL,
	"size_label_de" text,
	"price_gross" numeric(10, 2) NOT NULL,
	"sale_price_gross" numeric(10, 2),
	"is_available" boolean DEFAULT true NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"max_quantity" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "variant_price_positive" CHECK ("product_variant"."price_gross" > 0),
	CONSTRAINT "variant_quantity_range" CHECK ("product_variant"."max_quantity" IS NULL OR "product_variant"."max_quantity" >= "product_variant"."min_quantity")
);
--> statement-breakpoint
CREATE TABLE "blackout_date" (
	"id" serial PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"reason_de" text,
	CONSTRAINT "blackout_date_day_unique" UNIQUE("day")
);
--> statement-breakpoint
CREATE TABLE "delivery_run" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"run_date" date NOT NULL,
	"window_start" time NOT NULL,
	"window_end" time NOT NULL,
	"capacity" integer DEFAULT 20 NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	CONSTRAINT "run_capacity_positive" CHECK ("delivery_run"."capacity" >= 0),
	CONSTRAINT "run_window_ordered" CHECK ("delivery_run"."window_end" > "delivery_run"."window_start")
);
--> statement-breakpoint
CREATE TABLE "delivery_zone" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_de" text NOT NULL,
	"method" "delivery_method" DEFAULT 'own_van' NOT NULL,
	"fee_gross" numeric(10, 2) NOT NULL,
	"min_order_gross" numeric(10, 2) DEFAULT '40.00' NOT NULL,
	"free_over_gross" numeric(10, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "zone_fee_non_negative" CHECK ("delivery_zone"."fee_gross" >= 0)
);
--> statement-breakpoint
CREATE TABLE "delivery_zone_plz" (
	"id" serial PRIMARY KEY NOT NULL,
	"plz" char(4) NOT NULL,
	"ortschaft" text NOT NULL,
	"zone_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_schedule" (
	"weekday" integer PRIMARY KEY NOT NULL,
	"shop_open" boolean DEFAULT true NOT NULL,
	"delivery_enabled" boolean DEFAULT true NOT NULL,
	"min_lead_hours" integer DEFAULT 3 NOT NULL,
	CONSTRAINT "weekday_range" CHECK ("weekly_schedule"."weekday" BETWEEN 0 AND 6),
	CONSTRAINT "lead_hours_non_negative" CHECK ("weekly_schedule"."min_lead_hours" >= 0)
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"email_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"anonymised_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "customer_address" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"customer_id" bigint NOT NULL,
	"label_de" text,
	"recipient_name" text NOT NULL,
	"street" text NOT NULL,
	"plz" char(4) NOT NULL,
	"city" text NOT NULL,
	"phone" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"customer_id" bigint,
	"status" "order_status" DEFAULT 'new' NOT NULL,
	"buyer_name" text NOT NULL,
	"buyer_email" text NOT NULL,
	"buyer_phone" text,
	"buyer_phone_verified_at" timestamp with time zone,
	"recipient_name" text NOT NULL,
	"recipient_phone" text,
	"delivery_street" text,
	"delivery_plz" char(4),
	"delivery_city" text,
	"delivery_zone_name" text,
	"delivery_context" "delivery_context" DEFAULT 'residential' NOT NULL,
	"delivery_ward" text,
	"delivery_room" text,
	"deceased_name" text,
	"family_contact_phone" text,
	"delivery_instructions" text,
	"card_message" text,
	"card_is_anonymous" boolean DEFAULT false NOT NULL,
	"ribbon_text" text,
	"fulfilment" "fulfilment_type" NOT NULL,
	"delivery_run_id" bigint,
	"requested_delivery_at" timestamp with time zone,
	"delivery_date" date,
	"sort_time" time,
	"route_stop_order" integer,
	"printed_at" timestamp with time zone,
	"internal_notes" text,
	"subtotal_gross" numeric(10, 2) NOT NULL,
	"discount_code_snapshot" text,
	"discount_gross" numeric(10, 2) DEFAULT '0' NOT NULL,
	"loyalty_tier_snapshot" text,
	"loyalty_percent_snapshot" numeric(5, 2),
	"giftcard_applied_gross" numeric(10, 2) DEFAULT '0' NOT NULL,
	"delivery_fee_gross" numeric(10, 2) DEFAULT '0' NOT NULL,
	"delivery_fee_tax_rate" numeric(5, 4),
	"total_gross" numeric(10, 2) NOT NULL,
	"amount_due_gross" numeric(10, 2) NOT NULL,
	"placed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "order_run_requires_run_id" CHECK (("order"."fulfilment" = 'run') = ("order"."delivery_run_id" IS NOT NULL)),
	CONSTRAINT "order_timed_requires_datetime" CHECK (("order"."fulfilment" = 'timed') = ("order"."requested_delivery_at" IS NOT NULL)),
	CONSTRAINT "order_amount_due_consistent" CHECK ("order"."amount_due_gross" = "order"."total_gross" - "order"."giftcard_applied_gross"),
	CONSTRAINT "order_amount_due_non_negative" CHECK ("order"."amount_due_gross" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"parent_line_id" bigint,
	"product_id" bigint,
	"variant_id" bigint,
	"product_name_de" text NOT NULL,
	"variant_label_de" text,
	"unit_price_gross" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 4),
	"quantity" integer DEFAULT 1 NOT NULL,
	"line_total_gross" numeric(10, 2) NOT NULL,
	"colour_preference" text,
	"avoid_notes" text,
	CONSTRAINT "line_quantity_positive" CHECK ("order_line"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"method" "payment_method" NOT NULL,
	"provider_payment_intent_id" text,
	"amount_gross" numeric(10, 2) NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"marked_paid_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_payment_intent_id_unique" UNIQUE("provider_payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint NOT NULL,
	"payment_id" bigint,
	"amount_gross" numeric(10, 2) NOT NULL,
	"reason" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_event" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	CONSTRAINT "stripe_event_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "discount_code" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"min_order_gross" numeric(10, 2),
	"max_uses" integer,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "discount_code_code_unique" UNIQUE("code"),
	CONSTRAINT "discount_value_non_negative" CHECK ("discount_code"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "enquiry" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"type" "enquiry_type" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"event_date" date,
	"budget_range" text,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_tier" (
	"id" serial PRIMARY KEY NOT NULL,
	"name_de" text NOT NULL,
	"min_completed_orders" integer NOT NULL,
	"percent" numeric(5, 2) NOT NULL,
	CONSTRAINT "tier_percent_range" CHECK ("loyalty_tier"."percent" > 0 AND "loyalty_tier"."percent" < 100)
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" bigint,
	"channel" "notify_channel" NOT NULL,
	"recipient_type" "notify_recipient" NOT NULL,
	"address" text NOT NULL,
	"template" text NOT NULL,
	"sent_at" timestamp with time zone,
	"status" text,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "attribute_value" ADD CONSTRAINT "attribute_value_attribute_id_attribute_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."attribute"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tax_rate_id_tax_rate_id_fk" FOREIGN KEY ("tax_rate_id") REFERENCES "public"."tax_rate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value" ADD CONSTRAINT "product_attribute_value_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_attribute_value" ADD CONSTRAINT "product_attribute_value_attribute_value_id_attribute_value_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."attribute_value"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category" ADD CONSTRAINT "product_category_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_zone_plz" ADD CONSTRAINT "delivery_zone_plz_zone_id_delivery_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."delivery_zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_address" ADD CONSTRAINT "customer_address_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_delivery_run_id_delivery_run_id_fk" FOREIGN KEY ("delivery_run_id") REFERENCES "public"."delivery_run"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_parent_line_id_order_line_id_fk" FOREIGN KEY ("parent_line_id") REFERENCES "public"."order_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attribute_value_unique" ON "attribute_value" USING btree ("attribute_id","value");--> statement-breakpoint
CREATE INDEX "category_kind_sort_idx" ON "category" USING btree ("kind","sort_order");--> statement-breakpoint
CREATE INDEX "product_available_idx" ON "product" USING btree ("is_available","is_online_orderable","is_archived");--> statement-breakpoint
CREATE INDEX "product_sort_idx" ON "product" USING btree ("sort_order");--> statement-breakpoint
CREATE INDEX "pav_value_idx" ON "product_attribute_value" USING btree ("attribute_value_id");--> statement-breakpoint
CREATE INDEX "product_category_category_idx" ON "product_category" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "image_product_idx" ON "product_image" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "variant_product_idx" ON "product_variant" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "run_date_window_unique" ON "delivery_run" USING btree ("run_date","window_start");--> statement-breakpoint
CREATE INDEX "run_date_idx" ON "delivery_run" USING btree ("run_date");--> statement-breakpoint
CREATE UNIQUE INDEX "plz_ortschaft_unique" ON "delivery_zone_plz" USING btree ("plz","ortschaft");--> statement-breakpoint
CREATE INDEX "plz_lookup_idx" ON "delivery_zone_plz" USING btree ("plz");--> statement-breakpoint
CREATE INDEX "plz_zone_idx" ON "delivery_zone_plz" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_email_lower_unique" ON "customer" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "customer_phone_idx" ON "customer" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "address_customer_idx" ON "customer_address" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_run_idx" ON "order" USING btree ("delivery_run_id");--> statement-breakpoint
CREATE INDEX "order_delivery_date_idx" ON "order" USING btree ("delivery_date","sort_time");--> statement-breakpoint
CREATE INDEX "order_buyer_phone_idx" ON "order" USING btree ("buyer_phone");--> statement-breakpoint
CREATE INDEX "order_recipient_phone_idx" ON "order" USING btree ("recipient_phone");--> statement-breakpoint
CREATE INDEX "order_recipient_name_idx" ON "order" USING btree ("recipient_name");--> statement-breakpoint
CREATE INDEX "order_buyer_name_idx" ON "order" USING btree ("buyer_name");--> statement-breakpoint
CREATE INDEX "order_status_placed_idx" ON "order" USING btree ("status","placed_at");--> statement-breakpoint
CREATE INDEX "order_customer_idx" ON "order" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_today_idx" ON "order" USING btree ("delivery_run_id","route_stop_order");--> statement-breakpoint
CREATE INDEX "order_timed_idx" ON "order" USING btree ("requested_delivery_at");--> statement-breakpoint
CREATE INDEX "line_order_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "line_parent_idx" ON "order_line" USING btree ("parent_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "one_live_payment_per_order" ON "payment" USING btree ("order_id") WHERE status <> 'failed';--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payment" USING btree ("status");--> statement-breakpoint
CREATE INDEX "refund_order_idx" ON "refund" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "stripe_event_processed_idx" ON "stripe_event" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "enquiry_status_idx" ON "enquiry" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "notification_order_idx" ON "notification_log" USING btree ("order_id");