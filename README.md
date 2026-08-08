# Koshara

Koshara is a private household-expense dashboard. Milestones 1 and 2 provide an authenticated, household-isolated foundation plus reviewed CSV statement imports: a Clerk Organisation maps to one PostgreSQL household, members manage people/accounts, and bounded CSV files move through explicit mapping, candidate review, duplicate decisions, atomic commit, and complete rollback.

Committed transactions populate a paginated ledger and currency-safe initial dashboard. No sample financial data is bundled. PDF/R2, Gmail, categorisation, recurring analysis, exports, and deletion remain deferred to their later milestones.

## Start locally

Prerequisites: Node.js 22+, pnpm 11.9+, a Clerk application with Organisations enabled, and PostgreSQL.

```bash
pnpm install
cp .env.example apps/web/.env.local
pnpm db:migrate
pnpm dev
```

Set the five current variables documented in [DEVELOPMENT.md](./DEVELOPMENT.md) before exercising protected pages. The public landing page remains available without credentials so the production build and basic UI can be verified safely.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for design, guarantees, limitations, and operator steps.
