# Development

## Prerequisites

- Node.js 22 or newer
- pnpm 11.9.0 or newer
- PostgreSQL (Supabase is the production target)
- a Clerk development application with Google sign-in and Organisations enabled
- a private Cloudflare R2 bucket only when exercising the production storage provider
- a separate Google Cloud web OAuth client with the Gmail API enabled when exercising Gmail discovery

Install with `pnpm install`, copy `apps/web/.env.example` to `apps/web/.env.local`, and set the Clerk/application/PostgreSQL values. Local PDF imports use:

- `DOCUMENT_STORAGE_DRIVER=local`
- `LOCAL_DOCUMENT_STORAGE_PATH=.local/private-documents`

The relative storage path resolves beneath `apps/web`, is ignored by Git, and must remain outside `public`, source directories, and tracked content. It is development/test-only; the application rejects the local driver when `NODE_ENV=production`. Never put real statements in tracked directories.

To exercise the production-compatible Cloudflare provider, set `DOCUMENT_STORAGE_DRIVER=r2` and configure:

- `R2_ACCOUNT_ID`: 32-character lowercase Cloudflare account ID
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY`: bucket-scoped S3 API credentials
- `R2_BUCKET_NAME`: private bucket name
- `R2_ENDPOINT`: exact `https://<account-id>.r2.cloudflarestorage.com` endpoint

Manual Gmail discovery additionally requires:

- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: credentials for a dedicated web OAuth client, separate from Clerk sign-in
- `GOOGLE_OAUTH_REDIRECT_URI`: exactly `${NEXT_PUBLIC_APP_URL}/gmail/oauth/callback`, also registered exactly in Google Cloud
- `GMAIL_TOKEN_ENCRYPTION_KEY`: exactly 32 random bytes encoded as canonical base64 (for example, generate once with `openssl rand -base64 32` and store only in the environment secret manager)

Enable the Gmail API and configure the OAuth consent screen to request only `https://www.googleapis.com/auth/gmail.readonly`. Scheduled discovery and `CRON_SECRET` remain unset. Never put real production credentials, codes, tokens, encryption keys, identities, message metadata, or statements in fixtures, tests, screenshots, or logs.

## Database workflow

```bash
pnpm db:generate
pnpm db:migrate
```

Inspect generated SQL before applying it. Never edit or replace a migration already applied to a shared database; add a new migration.

## Daily checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit --audit-level high
```

PGlite integration tests apply every migration and use synthetic rows. PDF/Gmail tests construct synthetic files, provider JSON, tokens, and encrypted envelopes in memory; do not add real statements, mail, identities, passwords, codes, or credentials. The public Playwright suite uses no household identity. Authenticated Gmail automation requires disposable Google, Clerk, and PostgreSQL resources plus either isolated local storage or disposable R2 resources.

## Import fixtures and limits

- CSV: synthetic UTF-8 comma-delimited files only; one to five files, 2 MiB and 5,000 data rows each.
- PDF: one synthetic text-based file, 10 MiB, 100 pages, 5,000 extracted rows, 100 positional columns, and 15-second extraction limit.
- Dates: `DD/MM/YYYY`, `MM/DD/YYYY`, or `YYYY-MM-DD` selected explicitly.
- Amounts: period decimal separator; no embedded currency symbols.
- Password-protected PDF tests must generate their fixture/password in test code and assert the password never reaches storage/repository inputs or error messages.
- Gmail discovery: one explicit request per connection per minute, at most 25 matching messages and 50 bounded PDF descriptors; no automatic scheduling or page-token traversal.
- Gmail attachment bytes: at most 10 MiB decoded, fetched only for manual import, then passed through the same PDF validation/extraction/storage limits above.

## Astryx workflow

The generated `AGENTS.md` is the local Astryx contract. Discover components before changing UI:

```bash
pnpm exec astryx build "<interface idea>"
pnpm exec astryx template <name> --skeleton
pnpm exec astryx component <Name>
```

Use Astryx layout, typography, form, and feedback primitives; keep the shell responsive and keyboard-operable.
