CREATE TYPE "public"."account_type" AS ENUM('current', 'savings', 'credit-card', 'cash', 'wallet', 'other');--> statement-breakpoint
CREATE TYPE "public"."person_type" AS ENUM('member', 'dependent', 'other');--> statement-breakpoint
CREATE TABLE "financial_account_people" (
	"household_id" uuid NOT NULL,
	"financial_account_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "financial_account_people_household_id_financial_account_id_person_id_pk" PRIMARY KEY("household_id","financial_account_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "financial_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"institution_name" text NOT NULL,
	"display_name" text NOT NULL,
	"account_type" "account_type" NOT NULL,
	"masked_reference" text,
	"currency" text NOT NULL,
	"primary_person_id" uuid NOT NULL,
	"joint" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_accounts_household_id_id_unique" UNIQUE("household_id","id"),
	CONSTRAINT "financial_accounts_currency_check" CHECK ("financial_accounts"."currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_organization_id" text NOT NULL,
	"name" text NOT NULL,
	"base_currency" text DEFAULT 'INR' NOT NULL,
	"financial_year_start_month" integer DEFAULT 4 NOT NULL,
	"created_by_clerk_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "households_financial_year_month_check" CHECK ("households"."financial_year_start_month" between 1 and 12),
	CONSTRAINT "households_currency_check" CHECK ("households"."base_currency" ~ '^[A-Z]{3}$')
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"linked_clerk_user_id" text,
	"type" "person_type" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_household_id_id_unique" UNIQUE("household_id","id")
);
--> statement-breakpoint
ALTER TABLE "financial_account_people" ADD CONSTRAINT "financial_account_people_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_account_people" ADD CONSTRAINT "financial_account_people_account_household_fk" FOREIGN KEY ("household_id","financial_account_id") REFERENCES "public"."financial_accounts"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_account_people" ADD CONSTRAINT "financial_account_people_person_household_fk" FOREIGN KEY ("household_id","person_id") REFERENCES "public"."people"("household_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_accounts" ADD CONSTRAINT "financial_accounts_primary_person_household_fk" FOREIGN KEY ("household_id","primary_person_id") REFERENCES "public"."people"("household_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_account_people_household_person_idx" ON "financial_account_people" USING btree ("household_id","person_id");--> statement-breakpoint
CREATE INDEX "financial_accounts_household_active_idx" ON "financial_accounts" USING btree ("household_id","active");--> statement-breakpoint
CREATE INDEX "financial_accounts_household_person_idx" ON "financial_accounts" USING btree ("household_id","primary_person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "households_clerk_organization_id_unique" ON "households" USING btree ("clerk_organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "people_household_linked_user_unique" ON "people" USING btree ("household_id","linked_clerk_user_id") WHERE "people"."linked_clerk_user_id" is not null;--> statement-breakpoint
CREATE INDEX "people_household_active_idx" ON "people" USING btree ("household_id","active");