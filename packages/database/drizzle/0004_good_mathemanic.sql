CREATE TYPE "public"."gmail_attachment_status" AS ENUM('discovered', 'importing', 'imported');--> statement-breakpoint
CREATE TABLE "gmail_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"gmail_connection_id" uuid NOT NULL,
	"gmail_message_id" text NOT NULL,
	"gmail_attachment_id" text,
	"gmail_part_id" text NOT NULL,
	"original_filename" text NOT NULL,
	"content_type" text DEFAULT 'application/pdf' NOT NULL,
	"byte_size" integer NOT NULL,
	"message_received_at" timestamp with time zone NOT NULL,
	"status" "gmail_attachment_status" DEFAULT 'discovered' NOT NULL,
	"claimed_by_clerk_user_id" text,
	"claimed_at" timestamp with time zone,
	"import_session_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_attachments_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "gmail_attachments_provider_key_unique" UNIQUE("household_id","gmail_connection_id","gmail_message_id","gmail_part_id"),
	CONSTRAINT "gmail_attachments_message_id_check" CHECK (char_length("gmail_attachments"."gmail_message_id") between 1 and 255),
	CONSTRAINT "gmail_attachments_attachment_id_check" CHECK ("gmail_attachments"."gmail_attachment_id" is null or char_length("gmail_attachments"."gmail_attachment_id") between 1 and 1024),
	CONSTRAINT "gmail_attachments_part_id_check" CHECK (char_length("gmail_attachments"."gmail_part_id") between 1 and 255),
	CONSTRAINT "gmail_attachments_filename_check" CHECK (char_length("gmail_attachments"."original_filename") between 1 and 255 and lower("gmail_attachments"."original_filename") like '%.pdf'),
	CONSTRAINT "gmail_attachments_content_type_check" CHECK ("gmail_attachments"."content_type" = 'application/pdf'),
	CONSTRAINT "gmail_attachments_size_check" CHECK ("gmail_attachments"."byte_size" between 1 and 10485760),
	CONSTRAINT "gmail_attachments_state_check" CHECK ((
        "gmail_attachments"."status" = 'discovered'
        and "gmail_attachments"."claimed_by_clerk_user_id" is null
        and "gmail_attachments"."claimed_at" is null
        and "gmail_attachments"."import_session_id" is null
      ) or (
        "gmail_attachments"."status" = 'importing'
        and "gmail_attachments"."claimed_by_clerk_user_id" is not null
        and "gmail_attachments"."claimed_at" is not null
        and "gmail_attachments"."import_session_id" is null
      ) or (
        "gmail_attachments"."status" = 'imported'
        and "gmail_attachments"."claimed_by_clerk_user_id" is null
        and "gmail_attachments"."claimed_at" is null
        and "gmail_attachments"."import_session_id" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "gmail_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"connected_by_clerk_user_id" text NOT NULL,
	"email_address" text NOT NULL,
	"encrypted_refresh_token" text,
	"encrypted_access_token" text,
	"access_token_expires_at" timestamp with time zone,
	"scope" text NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_connections_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "gmail_connections_household_user_unique" UNIQUE("household_id","connected_by_clerk_user_id"),
	CONSTRAINT "gmail_connections_user_check" CHECK (char_length("gmail_connections"."connected_by_clerk_user_id") between 1 and 255),
	CONSTRAINT "gmail_connections_email_check" CHECK (char_length("gmail_connections"."email_address") between 3 and 254 and "gmail_connections"."email_address" = lower("gmail_connections"."email_address") and position('@' in "gmail_connections"."email_address") > 1),
	CONSTRAINT "gmail_connections_scope_check" CHECK ("gmail_connections"."scope" = 'https://www.googleapis.com/auth/gmail.readonly'),
	CONSTRAINT "gmail_connections_credential_state_check" CHECK ((
        "gmail_connections"."encrypted_refresh_token" is not null
        and "gmail_connections"."encrypted_access_token" is not null
        and "gmail_connections"."access_token_expires_at" is not null
        and "gmail_connections"."disconnected_at" is null
      ) or (
        "gmail_connections"."encrypted_refresh_token" is null
        and "gmail_connections"."encrypted_access_token" is null
        and "gmail_connections"."access_token_expires_at" is null
        and "gmail_connections"."disconnected_at" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "gmail_oauth_states" (
	"state_digest" text PRIMARY KEY NOT NULL,
	"household_id" uuid NOT NULL,
	"clerk_user_id" text NOT NULL,
	"encrypted_code_verifier" text NOT NULL,
	"redirect_uri" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gmail_oauth_states_digest_check" CHECK ("gmail_oauth_states"."state_digest" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "gmail_oauth_states_user_check" CHECK (char_length("gmail_oauth_states"."clerk_user_id") between 1 and 255),
	CONSTRAINT "gmail_oauth_states_verifier_check" CHECK (char_length("gmail_oauth_states"."encrypted_code_verifier") between 1 and 12000),
	CONSTRAINT "gmail_oauth_states_redirect_check" CHECK (char_length("gmail_oauth_states"."redirect_uri") between 1 and 2048)
);
--> statement-breakpoint
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_connection_household_fk" FOREIGN KEY ("household_id","gmail_connection_id") REFERENCES "public"."gmail_connections"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_attachments" ADD CONSTRAINT "gmail_attachments_session_household_fk" FOREIGN KEY ("household_id","import_session_id") REFERENCES "public"."import_sessions"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_connections" ADD CONSTRAINT "gmail_connections_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gmail_oauth_states" ADD CONSTRAINT "gmail_oauth_states_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gmail_attachments_import_session_unique" ON "gmail_attachments" USING btree ("household_id","import_session_id") WHERE "gmail_attachments"."import_session_id" is not null;--> statement-breakpoint
CREATE INDEX "gmail_attachments_household_user_status_idx" ON "gmail_attachments" USING btree ("household_id","gmail_connection_id","status");--> statement-breakpoint
CREATE INDEX "gmail_connections_household_idx" ON "gmail_connections" USING btree ("household_id");--> statement-breakpoint
CREATE INDEX "gmail_oauth_states_household_user_idx" ON "gmail_oauth_states" USING btree ("household_id","clerk_user_id","created_at");--> statement-breakpoint
CREATE INDEX "gmail_oauth_states_expiry_idx" ON "gmail_oauth_states" USING btree ("expires_at");