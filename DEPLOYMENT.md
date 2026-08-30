# Deployment

Milestone 4 requires Clerk, PostgreSQL, private Cloudflare R2, and a separate Google Cloud OAuth/Gmail configuration.

1. Create a Clerk application, enable Google sign-in and Organisations, and retain the basic `org:admin`/`org:member` roles.
2. Put only the exact approved addresses in `ALLOWED_USER_EMAILS`. Restrict Clerk production redirects/origins to the deployed domain.
3. Create a Supabase PostgreSQL project, use an SSL connection, and store it as `DATABASE_URL`.
4. Create a dedicated Cloudflare R2 bucket for original statements. Disable public development URLs and do not attach a public custom domain.
5. Create S3 API credentials restricted to that bucket. Record the account ID, access key, secret, bucket name, and exact account R2 endpoint in the deployment secret manager.
6. In a separate Google Cloud project/client from Clerk sign-in, enable the Gmail API, configure the OAuth consent screen for only `https://www.googleapis.com/auth/gmail.readonly`, and create a Web application OAuth client. Register exactly `https://<deployed-domain>/gmail/oauth/callback`; do not add wildcard, alternate-domain, query-string, or fragment variants.
7. Complete Google's restricted-scope verification/security requirements before production access. Do not add broader Gmail, Google profile, or OpenID scopes to this client.
8. Generate a 32-byte random encryption key (`openssl rand -base64 32`). Store the canonical base64 result, OAuth client secret, and client ID in the deployment secret manager; never reuse the Clerk, R2, database, or cron secrets.
9. Import the repository into Vercel with `apps/web` as the application root, Node.js 22, and pnpm 11.9+.
10. Configure `NEXT_PUBLIC_APP_URL`, Clerk keys, `ALLOWED_USER_EMAILS`, `DATABASE_URL`, `DOCUMENT_STORAGE_DRIVER=r2`, all five `R2_*` values, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, exact `GOOGLE_OAUTH_REDIRECT_URI`, and `GMAIL_TOKEN_ENCRYPTION_KEY`. Do not expose server values with `NEXT_PUBLIC_` prefixes. Leave `CRON_SECRET` unset because scheduled discovery is disabled.
11. From a trusted release environment, run `pnpm db:migrate` once. Confirm migrations through `0005_zippy_argent.sql` are applied before enabling Gmail connection.
12. Run lint, typecheck, tests, production build, dependency audit, and public browser tests.
13. With fully disposable Google/Clerk/PostgreSQL/R2 identities and documents, verify: account/household mismatch rejection; state-cookie mismatch and callback replay rejection; same-user reconnect; explicit discovery throttling/bounds; attachment idempotency; plain/password PDF import; mapping/review/duplicate decisions; commit/rollback; private download; disconnect/revocation; stale-claim recovery; wrong-household 404; checksum behavior; and mobile/security headers.
14. Confirm application/browser/platform logs never contain OAuth callback codes, tokens, encryption keys, provider error bodies, message bodies/subjects/snippets, attachment bytes, bucket/object URLs, R2 credentials, PDF passwords, or raw parser errors. Configure platform query-string redaction for `/gmail/oauth/callback` where available.
15. Confirm R2 public access remains disabled, bucket credentials cannot access unrelated buckets, Google redirect URIs remain exact, and OAuth credentials are restricted to the intended environment. Enable provider access/audit logs where available.

For a `DOCUMENT_CLEANUP_FAILED` response, pause new PDF uploads if failures persist. List only the affected private household prefix, compare keys to `statement_documents.object_key`, and delete an object only after confirming it has no metadata row. Do not bulk-delete a bucket/prefix or remove a referenced audit document.

Keep scheduled Gmail discovery disabled. Manual discovery, token encryption, revocation, and partial-failure recovery must remain verified before a later milestone introduces any queue, cron, watch, or push-notification path.

Use distinct Clerk, database, R2, and future Google credentials per environment and rotate them independently. Never print secret values, statements, passwords, or household identifiers in CI/deployment logs.
