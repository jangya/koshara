# Koshara

Koshara is a private household-expense dashboard. Milestone 1 establishes the authenticated, household-isolated foundation: a Clerk Organisation maps to one PostgreSQL household, and members can persist people and personal or joint financial accounts.

No sample financial data is bundled. CSV, PDF, Gmail, transaction review, dashboards backed by transactions, exports, and deletion are intentionally deferred to their later milestones.

## Start locally

Prerequisites: Node.js 22+, pnpm 11.9+, a Clerk application with Organisations enabled, and PostgreSQL.

```bash
pnpm install
cp .env.example apps/web/.env.local
pnpm db:migrate
pnpm dev
```

Set the five Milestone 1 variables documented in [DEVELOPMENT.md](./DEVELOPMENT.md) before exercising protected pages. The public landing page remains available without credentials so the production build and basic UI can be verified safely.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for design, guarantees, limitations, and operator steps.
