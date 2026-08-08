# Development

## Prerequisites

- Node.js 22 or newer
- pnpm 11.9.0
- PostgreSQL (Supabase is the production target)
- a Clerk development application with Google sign-in and Organisations enabled

Install dependencies with `pnpm install`. Copy `.env.example` to `apps/web/.env.local` and set:

- `NEXT_PUBLIC_APP_URL`: local value `http://localhost:3000`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk public key
- `CLERK_SECRET_KEY`: Clerk server key
- `ALLOWED_USER_EMAILS`: comma-separated exact email addresses
- `DATABASE_URL`: PostgreSQL connection string; use an SSL connection for hosted databases

R2, Google OAuth, Gmail encryption, and cron values are not needed through Milestone 2.

## Database workflow

Generate a new migration after an intentional schema change:

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
```

`pnpm test:e2e` verifies the credential-free landing page in desktop and mobile Chromium. Domain and PGlite tests exercise the synthetic CSV lifecycle. Authenticated household/import browser flows require disposable Clerk testing credentials and a disposable PostgreSQL database; do not use real household identities or financial data in automated tests.

## CSV fixtures

Use synthetic UTF-8 comma-delimited files only. A session accepts one to five files for one account. Each file is limited to 2 MB and 5,000 data rows. Supported date formats are `DD/MM/YYYY`, `MM/DD/YYYY`, and `YYYY-MM-DD`; amount cells use a period decimal separator and must not contain currency symbols.

## Astryx workflow

The generated `AGENTS.md` is the local Astryx contract. Discover components before changing UI:

```bash
pnpm exec astryx build "<interface idea>"
pnpm exec astryx template <name> --skeleton
pnpm exec astryx component <Name>
```

Use Astryx layout, typography, form, and feedback primitives; keep the shell responsive and keyboard-operable.
