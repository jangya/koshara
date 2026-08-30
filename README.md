# Koshara

Koshara is a private household-expense dashboard. Milestones 1–4 provide an authenticated, household-isolated foundation plus reviewed CSV, private PDF, and manual Gmail statement imports: a Clerk Organisation maps to one PostgreSQL household, members manage people/accounts, and bounded statement rows move through explicit mapping, candidate review, duplicate decisions, atomic commit, and complete rollback.

Original PDF statements are stored in a private Cloudflare R2 bucket with household-scoped PostgreSQL metadata and authenticated, integrity-checked access. Passwords for protected PDFs are transient and are never stored or logged. A separate Google OAuth connection requests only `gmail.readonly`, encrypts access/refresh tokens at rest, discovers bounded PDF attachment metadata only on request, and retrieves bytes only for an explicit manual import through the same PDF pipeline. Committed transactions populate a paginated ledger and currency-safe dashboard. No sample financial data, messages, documents, or credentials are bundled. Categorisation, recurring analysis, exports, retention deletion, automatic Gmail scheduling, and exchange-rate conversion remain deferred.

## Start locally

Prerequisites: Node.js 22+, pnpm 11.9+, a Clerk application with Organisations enabled, PostgreSQL, a private Cloudflare R2 bucket, and a separate Google Cloud web OAuth client with the Gmail API enabled.

```bash
pnpm install
cp .env.example apps/web/.env.local
pnpm db:migrate
pnpm dev
```

Set the environment variables documented in [DEVELOPMENT.md](./DEVELOPMENT.md). CSV imports can run without R2; PDF/Gmail import requires private R2, and Gmail connection additionally requires the Google OAuth and encryption values. The public landing page remains available without credentials so the production build and basic UI can be verified safely.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

See [docs/CURRENT_STATE.md](./docs/CURRENT_STATE.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the exact milestone contract, design, guarantees, limitations, and operator steps.
