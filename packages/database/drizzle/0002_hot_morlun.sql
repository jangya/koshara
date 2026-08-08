ALTER TABLE "import_candidates" DROP CONSTRAINT "import_candidates_file_household_fk";
--> statement-breakpoint
ALTER TABLE "transactions" DROP CONSTRAINT "transactions_candidate_household_fk";
--> statement-breakpoint
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_household_session_id_unique" UNIQUE("household_id","import_session_id","id");--> statement-breakpoint
ALTER TABLE "import_files" ADD CONSTRAINT "import_files_household_session_id_unique" UNIQUE("household_id","import_session_id","id");--> statement-breakpoint
ALTER TABLE "import_candidates" ADD CONSTRAINT "import_candidates_file_session_household_fk" FOREIGN KEY ("household_id","import_session_id","import_file_id") REFERENCES "public"."import_files"("household_id","import_session_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_candidate_session_household_fk" FOREIGN KEY ("household_id","source_import_session_id","source_import_candidate_id") REFERENCES "public"."import_candidates"("household_id","import_session_id","id") ON DELETE restrict ON UPDATE no action;
