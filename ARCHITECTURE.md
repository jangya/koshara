# Architecture

## Milestone 4 boundary

Koshara remains one Next.js App Router application in a pnpm workspace. Server Components handle reads, Route Handlers own the separate Google OAuth redirect/callback, Server Actions handle authenticated mutations, Clerk provides identity and organisation membership, Drizzle accesses PostgreSQL, Cloudflare R2 privately stores original PDF documents, direct HTTPS calls use Google OAuth/Gmail endpoints, and Astryx supplies interface primitives.

The packages retain narrow responsibilities:

- `apps/web`: routes, Clerk integration, request authorisation, strict Google OAuth state/callback handling, encrypted Gmail credentials, bounded Gmail API access, forms, CSV/PDF upload boundaries, the bounded PDF worker, R2 access, and the responsive shell.
- `packages/domain`: access rules, Zod schemas, strict CSV parsing/mapping, integer amount conversion, and duplicate classification.
- `packages/database`: schema, migrations, household-scoped repositories, document metadata, lifecycle transitions, and dashboard queries.
- `packages/ui`: brand configuration and shared Astryx styles.

## Request and data boundaries

Every protected page, document route, and Server Action resolves the Clerk session on the server, checks verified emails against `ALLOWED_USER_EMAILS`, requires active Clerk Organisation membership, maps that organisation to one household, and passes the resulting household ID to repositories. The Proxy establishes Clerk context and CSP headers; it is not the authorisation boundary.

Accounts, account holders, import files/candidates, transactions, and statement documents use composite keys containing `household_id`. A statement document additionally carries the import session/file provenance and a checked private object namespace containing the same household UUID.

Each Gmail connection is scoped by household and the allow-listed Clerk user who connected it. OAuth state is one-time, expires after ten minutes, binds the household/user/exact redirect, and stores only a SHA-256 state digest plus an AES-256-GCM-encrypted PKCE verifier. The callback also requires the initiating browser cookie, same authenticated Clerk user/household, exact `gmail.readonly` scope, and a Gmail profile address matching that user's verified Clerk address.

## Unified import lifecycle

One import session targets one household financial account and moves through `mapping`, `review`, `committed`, then optionally `rolled-back`. CSV parsing and PDF extraction both produce the same bounded `ParsedCsv` shape. Every source then uses explicit mapping/date format, candidate validation, duplicate classification, decisions, commit, and rollback.

PDF extraction is a hostile-input boundary. One validated 10 MiB PDF is sent to a dedicated PDF.js worker with page, text, field, row, column, image, memory, and time limits. Passwords exist only during parsing. The validated worker result is staged through the existing repository.

Original PDFs and relational metadata cannot be committed atomically across R2/PostgreSQL. The workflow writes the opaque household-namespaced object, then inserts metadata and parsed rows in one PostgreSQL transaction. Ambiguous object writes and database failures trigger compensating deletion. Cleanup failure is explicit and requires operator reconciliation.

Gmail discovery is an explicit, rate-limited read. It searches at most 25 matching messages, follows no result pagination, extracts at most 50 bounded PDF attachment descriptors, and does not persist message subjects, bodies, snippets, headers, or attachment bytes. A selected attachment is claimed idempotently, fetched with bounded retries/time/response size, revalidated by the exact Milestone 3 PDF boundary, stored privately, and linked to its import session in the same PostgreSQL transaction as import staging. Failed imports release their claim; stale claims are reset by a later explicit discovery.

Document access is never public or presigned. An authenticated route performs a household-scoped metadata lookup, fetches the private R2 object server-side, verifies length/checksum, and returns a non-cacheable attachment.

## Persistence

Migrations are append-only once applied to a shared environment. Migration `0003_flimsy_photon.sql` adds CSV/PDF source typing and `statement_documents`. Migration `0004_good_mathemanic.sql` adds one-time Gmail OAuth states, encrypted connection rows, and discovered attachment provenance/state constraints. Migration `0005_zippy_argent.sql` adds the last-discovery timestamp used by the one-minute per-connection throttle. Currency values remain ISO-style three-letter codes; account references may only be absent, masked, or last-four values.

## Deferred boundaries

Categories, recurring detection, richer reporting, export, retention/deletion, exchange-rate conversion, household erasure, scheduled Gmail discovery, push notifications, and production-grade parser isolation/queues remain later work.
