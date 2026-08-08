# Deployment

These steps cover the full planned product. Steps 1–12 are required through the Milestone 2 deployment; R2 and Gmail values may remain unset until their milestones exist.

1. Create a Clerk application.
2. Enable Google sign-in.
3. Enable Clerk Organisations and keep the basic `org:admin` and `org:member` roles.
4. Put the two exact approved addresses in the deployment's `ALLOWED_USER_EMAILS` value. Restrict Clerk production redirect URLs and allowed origins to the deployed domain.
5. Create a Supabase project.
6. Obtain its PostgreSQL connection string with SSL enabled and store it as `DATABASE_URL`.
7. From a trusted environment with that variable set, run `pnpm db:migrate` once per release.
8. In Milestone 3 (PDF document storage), create a private Cloudflare R2 bucket.
9. Create R2 credentials limited to that bucket; never grant account-wide write access.
10. Import the GitHub repository into Vercel with `apps/web` as the application root, Node.js 22, and pnpm 11.9.0.
11. Configure `NEXT_PUBLIC_APP_URL`, both Clerk keys, `ALLOWED_USER_EMAILS`, and `DATABASE_URL` in Vercel. Configure the remaining `.env.example` names only when their feature milestone ships.
12. Verify that the first approved user can sign in, create the Clerk Organisation household, add a person/account, invite the second approved user, and that an unapproved address is denied. Confirm the second member sees only that household.
13. In the Gmail milestone, create a Google Cloud project.
14. Enable the Gmail API.
15. Configure the OAuth consent screen as testing until production verification is complete.
16. Add both approved addresses as Google OAuth test users.
17. Add the deployed `/api/gmail/callback` URL exactly.
18. Generate and configure a dedicated Gmail token-encryption key.
19. Configure scheduled discovery only after manual Gmail import is implemented and verified.
20. Run the production lint, typecheck, test, build, migration, sign-in, isolation, CSV upload/mapping/review/commit/rollback, mobile, CSP, and response-header checks before widening access.

Cloud account creation and secret entry are intentionally manual. Do not print secret values in deployment logs or CI output. Use separate Clerk, database, R2, and Google credentials per environment and rotate them independently.
