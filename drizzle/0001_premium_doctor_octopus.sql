ALTER TABLE "order" ADD COLUMN "buyer_notified_out_for_delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_notified_delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "buyer_notified_failed_at" timestamp with time zone;