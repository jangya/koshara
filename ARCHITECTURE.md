# Architecture

## Milestone 1 boundary

Koshara is one Next.js App Router application in a pnpm workspace. It uses Server Components for reads, Server Actions for the three current mutations, Clerk for identity and organisation membership, Drizzle for PostgreSQL access, and Astryx for interface primitives.

The packages have deliberately narrow responsibilities:

- `apps/web`: routes, Clerk integration, request authorisation, forms, and the responsive shell.
- `packages/domain`: dependency-free access rules, input schemas, and financial-domain types.
- `packages/database`: PostgreSQL schema, migrations, and household-scoped repositories.
- `packages/ui`: brand configuration and shared Astryx styles.

Import and storage packages do not exist yet because Milestone 1 has no import or object-storage behaviour.

## Request and data boundary

Every protected page and Server Action resolves the Clerk session on the server, checks the current user's verified Clerk emails against `ALLOWED_USER_EMAILS`, requires an active Clerk Organisation, maps it to one application household, and passes only the resulting household id to repositories. The Proxy establishes Clerk request context and CSP headers; it is not the authorisation boundary.

Clerk organisation roles map as follows:

- `org:admin`: household owner; may invite members and provision the household record.
- `org:member`: household member; may use ordinary household features.

The database reinforces application checks. Accounts and account holders use composite foreign keys containing `household_id`, so a person from one household cannot be attached to another household's account even if application validation regresses.

## Persistence

The first migration creates `households`, `people`, `financial_accounts`, and `financial_account_people`. Migrations are committed SQL and are append-only once applied to a shared environment. Currency values are ISO-style three-letter codes; account references may only be absent, masked, or last-four values.

## Deferred boundaries

Statement import, R2 document storage, transaction models, categorisation, recurring detection, Gmail OAuth, reporting charts, export, deletion, and production audit operations belong to later milestones. Their environment-variable names are reserved, but no pretend integrations or placeholder data paths have been created.
