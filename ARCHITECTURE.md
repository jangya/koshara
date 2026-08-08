# Architecture

## Milestone 2 boundary

Koshara is one Next.js App Router application in a pnpm workspace. It uses Server Components for reads, Server Actions for authenticated mutations, Clerk for identity and organisation membership, Drizzle for PostgreSQL access, and Astryx for interface primitives.

The packages have deliberately narrow responsibilities:

- `apps/web`: routes, Clerk integration, request authorisation, forms, and the responsive shell.
- `packages/domain`: access rules, Zod input schemas, strict CSV parsing/mapping, integer amount conversion, and duplicate classification.
- `packages/database`: PostgreSQL schema, migrations, household-scoped repositories, import lifecycle transitions, and dashboard queries.
- `packages/ui`: brand configuration and shared Astryx styles.

No object-storage package exists yet. Milestone 2 stores bounded parsed CSV rows in PostgreSQL JSONB and discards original file bytes; private R2 document storage belongs to Milestone 3.

## Request and data boundary

Every protected page and Server Action resolves the Clerk session on the server, checks the current user's verified Clerk emails against `ALLOWED_USER_EMAILS`, requires an active Clerk Organisation, maps it to one application household, and passes only the resulting household id to repositories. The Proxy establishes Clerk request context and CSP headers; it is not the authorisation boundary.

Clerk organisation roles map as follows:

- `org:admin`: household owner; may invite members and provision the household record.
- `org:member`: household member; may use ordinary household features.

The database reinforces application checks. Accounts and account holders use composite foreign keys containing `household_id`, so a person from one household cannot be attached to another household's account even if application validation regresses.

## Import lifecycle

One import session targets one household financial account and moves through `mapping`, `review`, `committed`, then optionally `rolled-back`. Files are parsed before persistence, every file receives an explicit mapping/date format, and mapped rows become candidates. Invalid candidates are excluded; exact and probable duplicates remain pending until an Include/Skip decision is saved.

Session rows are locked for decision, mapping, commit, and rollback transitions. Commit also locks the target account and rechecks auto-included new candidates against current transactions; candidates made stale by another session return to pending duplicate review. Commit inserts included transactions with source-session/source-candidate provenance in one database transaction. Rollback deletes every sourced transaction and updates the session in one transaction while retaining candidate audit data.

Exact duplicates share account, date, integer minor-unit amount, and normalised description. Probable duplicates share account/amount within three calendar days. Dashboard aggregation groups currencies independently.

## Persistence

The first migration creates household/account tables. Milestone 2 migrations add import sessions/files/candidates/transactions and composite provenance constraints. Migrations are committed SQL and append-only once applied to a shared environment. Currency values are ISO-style three-letter codes; account references may only be absent, masked, or last-four values.

## Deferred boundaries

PDF/R2 document storage, categorisation, recurring detection, Gmail OAuth, richer reporting, export, deletion, and production audit operations belong to later milestones. Their environment-variable names are reserved, but no pretend integrations or placeholder data paths have been created.
