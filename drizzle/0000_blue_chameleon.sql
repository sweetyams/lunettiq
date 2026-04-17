CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'login', 'consent_change', 'tag_change', 'credit_adjustment', 'sync');--> statement-breakpoint
CREATE TYPE "public"."credit_transaction_type" AS ENUM('issued_membership', 'issued_birthday', 'issued_manual', 'issued_second_sight', 'redeemed_order', 'expired', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."custom_design_status" AS ENUM('draft', 'submitted', 'in_review', 'approved', 'in_production', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."interaction_direction" AS ENUM('inbound', 'outbound', 'internal');--> statement-breakpoint
CREATE TYPE "public"."interaction_type" AS ENUM('note', 'phone_call', 'email', 'sms', 'in_store_visit', 'fitting', 'purchase_assist', 'follow_up', 'complaint', 'product_recommendation', 'preferences_updated');--> statement-breakpoint
CREATE TYPE "public"."second_sight_grade" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."second_sight_status" AS ENUM('draft', 'submitted', 'graded', 'credited', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."surface" AS ENUM('web', 'tablet', 'phone', 'storefront', 'system');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text,
	"title" text NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled',
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"notes" text,
	"staff_id" text,
	"location_id" text,
	"external_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"staff_id" text,
	"surface" "surface" DEFAULT 'web',
	"location_id" text,
	"diff" jsonb,
	"status" text DEFAULT 'success',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collections_projection" (
	"shopify_collection_id" text PRIMARY KEY NOT NULL,
	"handle" text,
	"title" text,
	"product_ids" text[],
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "credits_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"transaction_type" "credit_transaction_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"running_balance" numeric(12, 2) NOT NULL,
	"reason" text,
	"related_order_id" text,
	"related_intake_id" uuid,
	"staff_id" text,
	"location_id" text,
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "custom_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"status" "custom_design_status" DEFAULT 'draft',
	"specs" jsonb,
	"reference_images" text[],
	"revisions" jsonb,
	"draft_order_id" text,
	"staff_id" text,
	"location_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers_projection" (
	"shopify_customer_id" text PRIMARY KEY NOT NULL,
	"email" text,
	"phone" text,
	"first_name" text,
	"last_name" text,
	"total_spent" numeric(12, 2),
	"order_count" integer DEFAULT 0,
	"tags" text[],
	"default_address" jsonb,
	"addresses" jsonb,
	"metafields" jsonb,
	"accepts_marketing" boolean DEFAULT false,
	"sms_consent" boolean DEFAULT false,
	"created_at" timestamp,
	"shopify_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"type" "interaction_type" NOT NULL,
	"direction" "interaction_direction" NOT NULL,
	"subject" text,
	"body" text,
	"metadata" jsonb,
	"staff_id" text,
	"location_id" text,
	"occurred_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "orders_projection" (
	"shopify_order_id" text PRIMARY KEY NOT NULL,
	"shopify_customer_id" text,
	"order_number" text,
	"financial_status" text,
	"fulfillment_status" text,
	"total_price" numeric(12, 2),
	"subtotal_price" numeric(12, 2),
	"currency" text,
	"line_items" jsonb,
	"shipping_address" jsonb,
	"tags" text[],
	"cancelled_at" timestamp,
	"processed_at" timestamp,
	"created_at" timestamp,
	"shopify_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "preferences_derived" (
	"shopify_customer_id" text PRIMARY KEY NOT NULL,
	"derived_shapes" jsonb,
	"derived_materials" jsonb,
	"derived_colours" jsonb,
	"derived_price_range" jsonb,
	"derived_lens_types" jsonb,
	"last_computed_at" timestamp DEFAULT now(),
	"source_order_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "product_variants_projection" (
	"shopify_variant_id" text PRIMARY KEY NOT NULL,
	"shopify_product_id" text,
	"title" text,
	"sku" text,
	"price" numeric(12, 2),
	"compare_at_price" numeric(12, 2),
	"inventory_quantity" integer,
	"selected_options" jsonb,
	"image_url" text,
	"available_for_sale" boolean DEFAULT true,
	"metafields" jsonb,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products_projection" (
	"shopify_product_id" text PRIMARY KEY NOT NULL,
	"handle" text,
	"title" text,
	"description" text,
	"product_type" text,
	"vendor" text,
	"tags" text[],
	"collections" text[],
	"images" jsonb,
	"metafields" jsonb,
	"price_min" numeric(12, 2),
	"price_max" numeric(12, 2),
	"created_at" timestamp,
	"shopify_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "second_sight_intakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"status" "second_sight_status" DEFAULT 'draft',
	"grade" "second_sight_grade",
	"photo_urls" text[],
	"current_frames" jsonb,
	"notes" text,
	"graded_by" text,
	"graded_at" timestamp,
	"credit_amount" numeric(12, 2),
	"staff_id" text,
	"location_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb NOT NULL,
	"member_count" integer DEFAULT 0,
	"created_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_appointments_customer" ON "appointments" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_date" ON "appointments" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_appointments_location" ON "appointments" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "idx_audit_entity" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_audit_created" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_credits_customer" ON "credits_ledger" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_designs_customer" ON "custom_designs" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_customers_email" ON "customers_projection" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_customers_name" ON "customers_projection" USING btree ("last_name","first_name");--> statement-breakpoint
CREATE INDEX "idx_interactions_customer" ON "interactions" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_interactions_occurred" ON "interactions" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "idx_orders_customer" ON "orders_projection" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_variants_product" ON "product_variants_projection" USING btree ("shopify_product_id");--> statement-breakpoint
CREATE INDEX "idx_intakes_customer" ON "second_sight_intakes" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_intakes_status" ON "second_sight_intakes" USING btree ("status");