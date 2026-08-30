CREATE TYPE "public"."import_source_type" AS ENUM('csv', 'pdf');--> statement-breakpoint
CREATE TABLE "statement_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"import_session_id" uuid NOT NULL,
	"import_file_id" uuid NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"byte_size" bigint NOT NULL,
	"checksum_sha256" text NOT NULL,
	"page_count" integer NOT NULL,
	"extracted_text_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "statement_documents_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "statement_documents_household_file_unique" UNIQUE("household_id","import_file_id"),
	CONSTRAINT "statement_documents_content_type_check" CHECK ("statement_documents"."content_type" = 'application/pdf'),
	CONSTRAINT "statement_documents_byte_size_check" CHECK ("statement_documents"."byte_size" between 1 and 10485760),
	CONSTRAINT "statement_documents_checksum_check" CHECK ("statement_documents"."checksum_sha256" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "statement_documents_page_count_check" CHECK ("statement_documents"."page_count" between 1 and 100),
	CONSTRAINT "statement_documents_text_size_check" CHECK ("statement_documents"."extracted_text_bytes" between 1 and 2097152),
	CONSTRAINT "statement_documents_object_key_check" CHECK ("statement_documents"."object_key" ~ '^households/[0-9a-f-]{36}/statements/[0-9a-f-]{36}\.pdf$' and "statement_documents"."object_key" like ('households/' || "statement_documents"."household_id"::text || '/statements/%'))
);
--> statement-breakpoint
ALTER TABLE "import_files" ADD COLUMN "source_type" "import_source_type" DEFAULT 'csv' NOT NULL;--> statement-breakpoint
ALTER TABLE "statement_documents" ADD CONSTRAINT "statement_documents_file_session_household_fk" FOREIGN KEY ("household_id","import_session_id","import_file_id") REFERENCES "public"."import_files"("household_id","import_session_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "statement_documents_object_key_unique" ON "statement_documents" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "statement_documents_household_checksum_idx" ON "statement_documents" USING btree ("household_id","checksum_sha256");
