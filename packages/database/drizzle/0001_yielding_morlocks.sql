CREATE TYPE "public"."import_candidate_decision" AS ENUM('pending', 'include', 'exclude');--> statement-breakpoint
CREATE TYPE "public"."import_candidate_kind" AS ENUM('invalid', 'new', 'exact', 'probable');--> statement-breakpoint
CREATE TYPE "public"."import_session_status" AS ENUM('mapping', 'review', 'committed', 'rolled-back');--> statement-breakpoint
CREATE TABLE "import_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"import_session_id" uuid NOT NULL,
	"import_file_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"transaction_date" date,
	"description" text,
	"amount_minor" bigint,
	"exact_fingerprint" text,
	"kind" "import_candidate_kind" NOT NULL,
	"decision" "import_candidate_decision" NOT NULL,
	"validation_errors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"matched_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_candidates_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "import_candidates_file_row_unique" UNIQUE("household_id","import_file_id","row_number"),
	CONSTRAINT "import_candidates_row_number_check" CHECK ("import_candidates"."row_number" > 1)
);
--> statement-breakpoint
CREATE TABLE "import_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"import_session_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"headers" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"mapping" jsonb,
	"row_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_files_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "import_files_name_length_check" CHECK (char_length("import_files"."original_filename") between 1 and 255),
	CONSTRAINT "import_files_row_count_check" CHECK ("import_files"."row_count" > 0)
);
--> statement-breakpoint
CREATE TABLE "import_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"status" "import_session_status" DEFAULT 'mapping' NOT NULL,
	"file_count" integer NOT NULL,
	"total_rows" integer NOT NULL,
	"valid_rows" integer DEFAULT 0 NOT NULL,
	"invalid_rows" integer DEFAULT 0 NOT NULL,
	"duplicate_rows" integer DEFAULT 0 NOT NULL,
	"committed_transactions" integer DEFAULT 0 NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"committed_at" timestamp with time zone,
	"rolled_back_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_sessions_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "import_sessions_counts_check" CHECK ("import_sessions"."file_count" > 0 and "import_sessions"."total_rows" > 0 and "import_sessions"."valid_rows" >= 0 and "import_sessions"."invalid_rows" >= 0 and "import_sessions"."duplicate_rows" >= 0 and "import_sessions"."committed_transactions" >= 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"transaction_date" date NOT NULL,
	"description" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"exact_fingerprint" text NOT NULL,
	"source_import_session_id" uuid NOT NULL,
	"source_import_candidate_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "transactions_household_source_candidate_unique" UNIQUE("household_id","source_import_candidate_id"),
	CONSTRAINT "transactions_amount_check" CHECK ("transactions"."amount_minor" <> 0),
	CONSTRAINT "transactions_currency_check" CHECK ("transactions"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_session_household_fk" FOREIGN KEY ("household_id","import_session_id") REFERENCES "public"."import_sessions"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_file_household_fk" FOREIGN KEY ("household_id","import_file_id") REFERENCES "public"."import_files"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_session_household_fk" FOREIGN KEY ("household_id","import_session_id") REFERENCES "public"."import_sessions"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_sessions" ADD CONSTRAINT "import_sessions_account_household_fk" FOREIGN KEY ("household_id","financial_account_id") REFERENCES "public"."financial_accounts"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_household_fk" FOREIGN KEY ("household_id","financial_account_id") REFERENCES "public"."financial_accounts"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_session_household_fk" FOREIGN KEY ("household_id","source_import_session_id") REFERENCES "public"."import_sessions"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_candidate_household_fk" FOREIGN KEY ("household_id","source_import_candidate_id") REFERENCES "public"."import_candidates"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_candidates_household_session_idx" ON "import_candidates" USING btree ("household_id","import_session_id");--> statement-breakpoint
CREATE INDEX "import_candidates_household_fingerprint_idx" ON "import_candidates" USING btree ("household_id","exact_fingerprint");--> statement-breakpoint
CREATE INDEX "import_files_household_session_idx" ON "import_files" USING btree ("household_id","import_session_id");--> statement-breakpoint
CREATE INDEX "import_sessions_household_created_idx" ON "import_sessions" USING btree ("household_id","created_at");--> statement-breakpoint
CREATE INDEX "transactions_household_date_idx" ON "transactions" USING btree ("household_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_household_account_date_idx" ON "transactions" USING btree ("household_id","financial_account_id","transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_household_fingerprint_idx" ON "transactions" USING btree ("household_id","exact_fingerprint");