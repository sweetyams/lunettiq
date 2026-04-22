CREATE TYPE "public"."brand_event_status" AS ENUM('draft', 'published', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."channel" AS ENUM('optical', 'sun', 'reglaze');--> statement-breakpoint
CREATE TYPE "public"."constraint_rule_type" AS ENUM('requires', 'excludes', 'allowed_only_with', 'hidden_until', 'default_if', 'defer_if_no_rx');--> statement-breakpoint
CREATE TYPE "public"."credit_code_status" AS ENUM('active', 'used', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."event_invite_status" AS ENUM('invited', 'accepted', 'declined', 'attended', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."gift_fulfilment_status" AS ENUM('pending', 'sourcing', 'shipped', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."gift_membership_status" AS ENUM('purchased', 'redeemed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ledger_currency" AS ENUM('credit', 'points');--> statement-breakpoint
CREATE TYPE "public"."option_layer" AS ENUM('channel', 'lens_path', 'material', 'finish_state', 'treatment', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."pricing_type" AS ENUM('absolute', 'delta');--> statement-breakpoint
CREATE TYPE "public"."product_interaction_source" AS ENUM('crm_web', 'tablet', 'storefront', 'klaviyo_click', 'system');--> statement-breakpoint
CREATE TYPE "public"."product_interaction_type" AS ENUM('viewed', 'recommended', 'tried_on', 'liked', 'disliked', 'shared', 'saved', 'purchased');--> statement-breakpoint
CREATE TYPE "public"."product_sentiment" AS ENUM('love', 'like', 'neutral', 'dislike');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('pending', 'qualified', 'fraudulent', 'expired');--> statement-breakpoint
CREATE TYPE "public"."return_reason" AS ENUM('doesnt_fit', 'doesnt_suit', 'colour_different', 'changed_mind', 'received_damaged', 'received_wrong', 'rx_issue', 'other');--> statement-breakpoint
CREATE TYPE "public"."return_resolution" AS ENUM('refund', 'credit', 'exchange');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('requested', 'label_sent', 'in_transit', 'received', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."rx_state" AS ENUM('none', 'pending', 'provided', 'validated', 'flagged');--> statement-breakpoint
CREATE TYPE "public"."selection_mode" AS ENUM('single', 'multi', 'none');--> statement-breakpoint
CREATE TYPE "public"."trial_outcome" AS ENUM('pending', 'converted', 'cancelled', 'clawback_applied');--> statement-breakpoint
CREATE TYPE "public"."try_on_outcome" AS ENUM('purchased', 'saved_for_later', 'no_match', 'needs_followup');--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_signup';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_purchase';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_birthday';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_review';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_referral_referrer';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_referral_referred';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_issued_milestone';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_redeemed_order';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_redeemed_membership_conversion';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'points_expired';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'membership_trial_started';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'membership_trial_converted';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'membership_trial_cancelled';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'membership_trial_clawback';--> statement-breakpoint
ALTER TYPE "public"."credit_transaction_type" ADD VALUE 'referral_qualified';--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"model" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_estimate_cents" integer,
	"requested_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointment_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"duration_minutes" integer DEFAULT 30 NOT NULL,
	"buffer_minutes" integer DEFAULT 0 NOT NULL,
	"location_id" text,
	"active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "archive_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"product_handle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "brand_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"capacity" integer,
	"tier_minimum" text DEFAULT 'vault',
	"status" "brand_event_status" DEFAULT 'draft',
	"image_url" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "client_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_a" text NOT NULL,
	"client_b" text NOT NULL,
	"relationship" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "colour_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"members" text[] NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "configuration_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "channel" NOT NULL,
	"shopify_product_id" text,
	"shopify_variant_id" text,
	"shopify_order_id" text,
	"shopify_draft_order_id" text,
	"selected_lens_path" text,
	"selected_material" text,
	"selected_finish_state" text,
	"selected_treatments" jsonb DEFAULT '[]'::jsonb,
	"rx_state" "rx_state" DEFAULT 'none',
	"pricing_lines" jsonb NOT NULL,
	"total_cad" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "constraint_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"rule_type" "constraint_rule_type" NOT NULL,
	"source_option_code" text NOT NULL,
	"target_option_codes" jsonb NOT NULL,
	"context" jsonb,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "constraint_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "credit_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"method" text NOT NULL,
	"code" text NOT NULL,
	"full_code" text,
	"amount" numeric(12, 2) NOT NULL,
	"status" "credit_code_status" DEFAULT 'active',
	"shopify_gift_card_id" text,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"revoked_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "draft_orders_projection" (
	"shopify_draft_order_id" text PRIMARY KEY NOT NULL,
	"shopify_customer_id" text,
	"name" text,
	"email" text,
	"status" text,
	"total_price" numeric(12, 2),
	"subtotal_price" numeric(12, 2),
	"currency" text,
	"line_items" jsonb,
	"shipping_address" jsonb,
	"invoice_url" text,
	"order_id_on_complete" text,
	"tags" text[],
	"note" text,
	"created_at" timestamp,
	"shopify_updated_at" timestamp,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "duplicate_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_a" text NOT NULL,
	"client_b" text NOT NULL,
	"match_reason" text NOT NULL,
	"confidence" numeric(3, 2) NOT NULL,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "event_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"status" "event_invite_status" DEFAULT 'invited',
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "filter_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "gift_fulfilments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"year" integer NOT NULL,
	"status" "gift_fulfilment_status" DEFAULT 'pending',
	"gift_description" text,
	"tracking_number" text,
	"shipped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gift_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"purchaser_customer_id" text NOT NULL,
	"recipient_customer_id" text,
	"recipient_email" text,
	"tier" text NOT NULL,
	"duration_months" integer DEFAULT 12 NOT NULL,
	"status" "gift_membership_status" DEFAULT 'purchased',
	"purchased_at" timestamp with time zone DEFAULT now(),
	"redeemed_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"message" text
);
--> statement-breakpoint
CREATE TABLE "integrations_config" (
	"id" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false,
	"keys" jsonb,
	"configured_at" timestamp with time zone,
	"configured_by" text,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" text PRIMARY KEY NOT NULL,
	"shopify_location_id" text,
	"square_location_id" text,
	"name" text NOT NULL,
	"address" jsonb,
	"timezone" text DEFAULT 'America/Montreal',
	"max_concurrent" integer DEFAULT 1,
	"active" boolean DEFAULT true,
	"synced_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "loyalty_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"tag" text NOT NULL,
	"monthly_credit" numeric(8, 2) NOT NULL,
	"birthday_credit" numeric(8, 2) DEFAULT '20',
	"trade_in_rate" numeric(4, 3) NOT NULL,
	"lens_refresh" boolean DEFAULT false,
	"frame_rotation" text,
	"sort_order" integer DEFAULT 0,
	"active" boolean DEFAULT true,
	"monthly_fee" numeric(8, 2),
	"annual_fee" numeric(8, 2),
	"second_sight_rate" numeric(4, 3),
	"early_access_hours" integer DEFAULT 0,
	"named_optician" boolean DEFAULT false,
	"free_repairs" text,
	"style_consultation" text,
	"events_per_year" integer DEFAULT 0,
	"annual_gift" boolean DEFAULT false,
	"archive_vote" boolean DEFAULT false,
	"private_whatsapp" boolean DEFAULT false,
	"shipping_tier" text,
	"referral_reward_credit" numeric(8, 2),
	"referral_extension_months" integer DEFAULT 0,
	"referred_discount" numeric(8, 2),
	"referred_trial_tier" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "membership_trials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"tier" text DEFAULT 'cult' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now(),
	"credits_issued_at_start" numeric(12, 2),
	"credits_used_during_trial" numeric(12, 2) DEFAULT '0',
	"outcome" "trial_outcome" DEFAULT 'pending',
	"converts_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"clawback_amount" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"type" text DEFAULT 'info' NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "option_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"layer" "option_layer" NOT NULL,
	"selection_mode" "selection_mode" DEFAULT 'single' NOT NULL,
	"required" boolean DEFAULT false,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "option_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"channels" jsonb DEFAULT '["optical","sun"]'::jsonb,
	"customer_visible" boolean DEFAULT true,
	"active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "options_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"amount_cad" numeric(12, 2) NOT NULL,
	"pricing_type" "pricing_type" DEFAULT 'delta' NOT NULL,
	"channels" jsonb DEFAULT '["optical","sun"]'::jsonb,
	"option_codes" jsonb NOT NULL,
	"conditions" jsonb,
	"active" boolean DEFAULT true,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "price_rules_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "product_colours" (
	"product_id" text NOT NULL,
	"colour_group_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_families" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_family_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" text NOT NULL,
	"product_id" text NOT NULL,
	"type" text,
	"colour" text,
	"colour_hex" text,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "product_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"shopify_product_id" text NOT NULL,
	"sentiment" "product_sentiment",
	"try_on_count" integer DEFAULT 0,
	"view_count" integer DEFAULT 0,
	"last_interaction_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"filter_group_id" text NOT NULL,
	"status" text DEFAULT 'auto' NOT NULL,
	"matched_by" text
);
--> statement-breakpoint
CREATE TABLE "product_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"shopify_product_id" text NOT NULL,
	"shopify_variant_id" text,
	"interaction_type" "product_interaction_type" NOT NULL,
	"source" "product_interaction_source" NOT NULL,
	"staff_id" text,
	"location_id" text,
	"session_id" text,
	"metadata" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_mappings" (
	"square_catalog_id" text PRIMARY KEY NOT NULL,
	"square_name" text,
	"shopify_product_id" text,
	"shopify_variant_id" text,
	"confidence" numeric(3, 2),
	"status" text DEFAULT 'unmatched',
	"parsed_frame" text,
	"parsed_colour" text,
	"parsed_type" text,
	"family_id" text,
	"matched_by" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_customer_id" text NOT NULL,
	"referrer_code" text NOT NULL,
	"referred_customer_id" text,
	"referred_email" text,
	"status" "referral_status" DEFAULT 'pending',
	"clicked_at" timestamp with time zone DEFAULT now(),
	"signed_up_at" timestamp with time zone,
	"qualified_at" timestamp with time zone,
	"qualifying_order_id" text,
	"referrer_tier_at_qualification" text,
	"referrer_reward_amount" numeric(12, 2),
	"referrer_reward_currency" "ledger_currency",
	"fraud_signals" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"line_items" jsonb NOT NULL,
	"resolution_type" "return_resolution" NOT NULL,
	"resolution_amount" numeric(12, 2),
	"status" "return_status" DEFAULT 'requested',
	"return_reason_primary" "return_reason" NOT NULL,
	"return_reason_detail" text,
	"exchange_order_id" text,
	"shipping_label_url" text,
	"requested_at" timestamp with time zone DEFAULT now(),
	"received_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"rejected_reason" text,
	"staff_id" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"query_raw" text NOT NULL,
	"query_normalized" text NOT NULL,
	"result_count" integer DEFAULT 0,
	"personalized" boolean DEFAULT false,
	"synonym_fired" text,
	"zero_results" boolean DEFAULT false,
	"clicked_products" jsonb,
	"time_to_click_ms" integer,
	"filters_applied" jsonb,
	"customer_id" text,
	"session_id" text,
	"device_type" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "search_synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"terms" text[] NOT NULL,
	"active" boolean DEFAULT true,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "staff_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"location_id" text
);
--> statement-breakpoint
CREATE TABLE "step_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "channel" NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0,
	"option_group_codes" jsonb NOT NULL,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "step_definitions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "try_on_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shopify_customer_id" text NOT NULL,
	"staff_id" text,
	"location_id" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"frames_tried" integer DEFAULT 0,
	"outcome_tag" "try_on_outcome",
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "starts_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "ends_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "updated_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "appointments" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "recurrence_rule" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_id" uuid;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_index" integer;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "series_exceptions" jsonb;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_role" text;--> statement-breakpoint
ALTER TABLE "credits_ledger" ADD COLUMN "currency" "ledger_currency" DEFAULT 'credit' NOT NULL;--> statement-breakpoint
ALTER TABLE "credits_ledger" ADD COLUMN "related_referral_id" uuid;--> statement-breakpoint
ALTER TABLE "credits_ledger" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders_projection" ADD COLUMN "source" text DEFAULT 'shopify';--> statement-breakpoint
ALTER TABLE "orders_projection" ADD COLUMN "location_id" text;--> statement-breakpoint
ALTER TABLE "products_projection" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "products_projection" ADD COLUMN "status" text DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "options" ADD CONSTRAINT "options_group_id_option_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."option_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_votes_unique" ON "archive_votes" USING btree ("year","shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_votes_year" ON "archive_votes" USING btree ("year");--> statement-breakpoint
CREATE INDEX "idx_events_date" ON "brand_events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "idx_links_a" ON "client_links" USING btree ("client_a");--> statement-breakpoint
CREATE INDEX "idx_links_b" ON "client_links" USING btree ("client_b");--> statement-breakpoint
CREATE INDEX "idx_config_snapshots_order" ON "configuration_snapshots" USING btree ("shopify_order_id");--> statement-breakpoint
CREATE INDEX "idx_config_snapshots_draft" ON "configuration_snapshots" USING btree ("shopify_draft_order_id");--> statement-breakpoint
CREATE INDEX "idx_constraint_rules_source" ON "constraint_rules" USING btree ("source_option_code");--> statement-breakpoint
CREATE INDEX "idx_credit_codes_customer" ON "credit_codes" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_credit_codes_status" ON "credit_codes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_draft_orders_customer" ON "draft_orders_projection" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_draft_orders_status" ON "draft_orders_projection" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_dedup_status" ON "duplicate_candidates" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_invites_event" ON "event_invites" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_invites_customer" ON "event_invites" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_fg_type" ON "filter_groups" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_gifts_customer" ON "gift_fulfilments" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_gifts_status" ON "gift_fulfilments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_gift_code" ON "gift_memberships" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_gift_purchaser" ON "gift_memberships" USING btree ("purchaser_customer_id");--> statement-breakpoint
CREATE INDEX "idx_trials_customer" ON "membership_trials" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_user" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_options_group" ON "options" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_options_code" ON "options" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_price_rules_code" ON "price_rules" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "product_colours_pk" ON "product_colours" USING btree ("product_id","colour_group_id");--> statement-breakpoint
CREATE INDEX "idx_pc_product" ON "product_colours" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pfm_family_product_uniq" ON "product_family_members" USING btree ("family_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_pfm_family" ON "product_family_members" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "idx_pfm_product" ON "product_family_members" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_pf_unique" ON "product_feedback" USING btree ("shopify_customer_id","shopify_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pf_product_filter_uniq" ON "product_filters" USING btree ("product_id","filter_group_id");--> statement-breakpoint
CREATE INDEX "idx_pf_product" ON "product_filters" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "idx_pf_filter" ON "product_filters" USING btree ("filter_group_id");--> statement-breakpoint
CREATE INDEX "idx_pi_customer" ON "product_interactions" USING btree ("shopify_customer_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_pi_product" ON "product_interactions" USING btree ("shopify_product_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_pi_type" ON "product_interactions" USING btree ("interaction_type");--> statement-breakpoint
CREATE INDEX "idx_pi_session" ON "product_interactions" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_referrals_referrer" ON "referrals" USING btree ("referrer_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_referrals_code" ON "referrals" USING btree ("referrer_code");--> statement-breakpoint
CREATE INDEX "idx_referrals_status" ON "referrals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_returns_customer" ON "returns" USING btree ("shopify_customer_id");--> statement-breakpoint
CREATE INDEX "idx_returns_order" ON "returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_returns_status" ON "returns" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_search_queries_normalized" ON "search_queries" USING btree ("query_normalized");--> statement-breakpoint
CREATE INDEX "idx_search_queries_created" ON "search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_search_queries_customer" ON "search_queries" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "idx_staff_schedules_staff" ON "staff_schedules" USING btree ("staff_id","day_of_week");--> statement-breakpoint
CREATE INDEX "idx_tryon_customer" ON "try_on_sessions" USING btree ("shopify_customer_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_appointments_series" ON "appointments" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "idx_audit_staff" ON "audit_log" USING btree ("staff_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_credits_currency" ON "credits_ledger" USING btree ("shopify_customer_id","currency");--> statement-breakpoint
CREATE INDEX "idx_credits_expiry" ON "credits_ledger" USING btree ("expires_at");