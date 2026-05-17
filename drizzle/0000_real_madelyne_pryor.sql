CREATE TYPE "public"."delivery_zone" AS ENUM('local', 'eu', 'non_eu');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending_review', 'approved', 'rejected', 'synced', 'sync_failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('invoice', 'proforma', 'delivery_note');--> statement-breakpoint
CREATE TYPE "public"."sync_adapter" AS ENUM('stub', 'export', 'api', 'agent');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('queued', 'running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('scanner', 'reviewer', 'admin');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "correction_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"supplier_id" uuid,
	"field_path" text NOT NULL,
	"ai_value" jsonb,
	"user_value" jsonb,
	"note" text,
	"corrected_by" uuid,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "document_type" NOT NULL,
	"document_number" text,
	"issue_date" timestamp,
	"due_date" timestamp,
	"delivery_date" timestamp,
	"supplier_id" uuid,
	"supplier_name_raw" text,
	"currency" text,
	"subtotal" numeric(18, 4),
	"vat_total" numeric(18, 4),
	"total" numeric(18, 4),
	"delivery_zone" "delivery_zone",
	"customs_ref" text,
	"status" "document_status" DEFAULT 'pending_review' NOT NULL,
	"original_file_path" text NOT NULL,
	"thumbnail_path" text,
	"original_mime_type" text,
	"original_size_bytes" bigint,
	"content_hash" text,
	"raw_ai_extraction" jsonb,
	"confidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"final_extraction" jsonb,
	"extractor_provider" text,
	"zeron_id" text,
	"synced_at" timestamp with time zone,
	"created_by" uuid,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"quantity" numeric(18, 4),
	"unit" text,
	"unit_price" numeric(18, 4),
	"vat_rate" numeric(6, 3),
	"line_total" numeric(18, 4),
	"matched_zeron_item_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supplier_extraction_profiles" (
	"supplier_id" uuid PRIMARY KEY NOT NULL,
	"hints" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recent_examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"vat_number" text,
	"eik" text,
	"country_code" text,
	"address" text,
	"default_currency" text,
	"delivery_zone" "delivery_zone",
	"zeron_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"adapter" "sync_adapter" NOT NULL,
	"status" "sync_status" NOT NULL,
	"payload" jsonb,
	"response" jsonb,
	"error" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"is_current" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"role" "user_role" DEFAULT 'scanner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "correction_logs" ADD CONSTRAINT "correction_logs_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "correction_logs" ADD CONSTRAINT "correction_logs_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "correction_logs" ADD CONSTRAINT "correction_logs_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "documents" ADD CONSTRAINT "documents_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "line_items" ADD CONSTRAINT "line_items_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "supplier_extraction_profiles" ADD CONSTRAINT "supplier_extraction_profiles_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sync_attempts" ADD CONSTRAINT "sync_attempts_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correction_logs_document_idx" ON "correction_logs" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "correction_logs_supplier_field_idx" ON "correction_logs" USING btree ("supplier_id","field_path");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_supplier_idx" ON "documents" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_status_idx" ON "documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_created_at_idx" ON "documents" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "documents_content_hash_idx" ON "documents" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "line_items_document_idx" ON "line_items" USING btree ("document_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "line_items_doc_position_uq" ON "line_items" USING btree ("document_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_normalized_idx" ON "suppliers" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_vat_idx" ON "suppliers" USING btree ("vat_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "suppliers_eik_idx" ON "suppliers" USING btree ("eik");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_attempts_document_idx" ON "sync_attempts" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sync_attempts_status_idx" ON "sync_attempts" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree ("email");