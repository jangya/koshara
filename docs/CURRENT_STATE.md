# Koshara current state

Last verified: 2026-08-08
Baseline repository commit: `d266b84` (`feat: establish Koshara milestone 1 foundation`)

Koshara has completed Milestone 2 in the current working tree. The repository now contains a production-buildable CSV import, review, transaction, rollback, and initial-dashboard workflow on top of the Milestone 1 household foundation. It has not been connected to real Clerk, PostgreSQL, R2, or hosting resources in this workspace.

## What was completed

### Milestone 1 foundation retained

- A pnpm workspace using Node.js 22+, Next.js 16 App Router, React 19, strict TypeScript, Clerk Organisations, Drizzle, PostgreSQL, and Astryx.
- Server-side verified-email allow-listing and household membership/role checks.
- Household people and personal or joint financial accounts.
- Household-scoped repositories and composite database constraints preventing cross-household ownership.
- CSP, baseline browser security headers, environment validation, CI configuration, and operator documentation.

### Milestone 2 CSV imports

- Multi-file CSV upload: one to five files per session, each limited to 2 MB and 5,000 data rows.
- A persistent household/account-scoped import-session lifecycle: `mapping -> review -> committed -> rolled-back`.
- Strict CSV parsing for quoted commas, escaped quotes, multiline fields, BOM/CRLF input, uniform columns, and bounded field/header sizes.
- Explicit per-file mapping for date, description, signed amount, or separate debit/credit columns.
- Explicit `DD/MM/YYYY`, `MM/DD/YYYY`, or `YYYY-MM-DD` selection; day/month order is never inferred.
- Candidate staging before transaction writes, including row-level validation errors and zero-amount rejection.
- Exact duplicate detection using account, date, integer minor-unit amount, and Unicode-normalised description.
- Probable duplicate detection using the same account and amount within three calendar days when the exact fingerprint differs.
- Explicit Include/Skip decisions for exact and probable duplicates; unresolved duplicate decisions block commit.
- Atomic commit of included candidates with source session/candidate provenance, including a locked recheck that returns stale new candidates to duplicate review when another session committed a match after mapping.
- Complete atomic rollback of every transaction sourced from a committed import while retaining session, file, mapping, and candidate audit data.
- A 25-row paginated import-history page, mapping view, and 100-row candidate review pages.
- A paginated transactions page showing committed real data only.
- Initial dashboard metrics grouped by currency, plus household-wide transaction count and recent committed transactions. Different currencies are never added together without conversion.
- A database-backed household upload throttle of ten new import sessions per rolling hour, serialized under a household row lock.

No sample financial records, statement files, or credentials are committed.

## Key architecture decisions

1. **The existing application boundary remains.** `apps/web` uses Server Components for reads and authenticated Server Actions for mutations. No separate API service, job system, or microservice was introduced.
2. **Pure import rules live in the domain package.** CSV parsing, explicit date/amount mapping, normalisation, fingerprints, and indexed duplicate classification are dependency-light domain code with deterministic unit tests.
3. **Persistence owns lifecycle invariants.** `packages/database` creates sessions, stages candidates, applies decisions, commits, rolls back, paginates, and calculates summaries. Every public repository operation requires `household_id`.
4. **Parsed rows are staged in PostgreSQL for Milestone 2.** Bounded parsed CSV rows and mappings are stored as JSONB so upload and mapping can be separate authenticated requests without prematurely introducing R2. Original file bytes are not retained.
5. **Transactions use integer minor units.** Imported amounts are converted to signed integers before duplicate detection or persistence, avoiding binary floating-point comparisons.
6. **Duplicate handling is deterministic and commit-safe.** Exact matches use a canonical fingerprint. Probable matches use equal account/amount and a fixed three-day window. Both duplicate kinds begin in `pending` and require an explicit user decision. Commit locks the account and rechecks auto-included new candidates so a stale review cannot silently insert a duplicate created by another session.
7. **Commit and rollback are database transactions.** Session rows are locked before state transitions. Commit is idempotency-safe for an already committed session; rollback is idempotency-safe for an already rolled-back session.
8. **Provenance is enforced in PostgreSQL.** Composite keys require import files, candidates, sessions, accounts, and transaction sources to belong to the same household and import session. Repository mistakes cannot silently cross these boundaries.
9. **Large review surfaces are bounded and deterministic.** Candidate inserts are batched, duplicate lookups are indexed in memory by fingerprint/account/amount, and transaction/candidate pages use server-side pagination with complete tie-breaking sort keys.
10. **Dashboard totals are currency-safe.** Currency groups are aggregated independently. No exchange-rate or base-currency conversion is invented.
11. **Upload limits exist at both framework and application boundaries.** Next.js accepts an 11 MB Server Action body so five 2 MB CSV files plus multipart overhead can reach the action. The authenticated application boundary remains stricter: at most five files, 2 MB per file, and 10 MB of file content in total.

## Important files

| Area | File | Purpose |
| --- | --- | --- |
| Milestone contract | [`docs/CURRENT_STATE.md`](./CURRENT_STATE.md) | Completed behavior, limitations, and next milestone |
| Domain import rules | [`packages/domain/src/imports.ts`](../packages/domain/src/imports.ts) | CSV parser, mapping, amounts, dates, fingerprints, duplicate detector |
| Domain tests | [`packages/domain/src/imports.test.ts`](../packages/domain/src/imports.test.ts) | Deterministic CSV/mapping/duplicate specifications |
| Database schema | [`packages/database/src/schema.ts`](../packages/database/src/schema.ts) | Household, import, candidate, and transaction tables/constraints |
| Import repositories | [`packages/database/src/import-repositories.ts`](../packages/database/src/import-repositories.ts) | Lifecycle, pagination, summaries, commit, and rollback |
| Lifecycle tests | [`packages/database/src/imports.integration.test.ts`](../packages/database/src/imports.integration.test.ts) | PGlite end-to-end import and isolation coverage |
| Import actions | [`apps/web/src/app/(app)/import-actions.ts`](<../apps/web/src/app/(app)/import-actions.ts>) | Authenticated and validated workflow mutations |
| Upload boundary | [`apps/web/src/lib/import-upload.ts`](../apps/web/src/lib/import-upload.ts) | File count/type/size/name validation and CSV parsing |
| Import list | [`apps/web/src/app/(app)/imports/page.tsx`](<../apps/web/src/app/(app)/imports/page.tsx>) | Upload and session history |
| Import detail | [`apps/web/src/app/(app)/imports/[importSessionId]/page.tsx`](<../apps/web/src/app/(app)/imports/[importSessionId]/page.tsx>) | Mapping, review, commit, and rollback surface |
| Transactions | [`apps/web/src/app/(app)/transactions/page.tsx`](<../apps/web/src/app/(app)/transactions/page.tsx>) | Paginated committed transaction ledger |
| Dashboard | [`apps/web/src/app/(app)/dashboard/page.tsx`](<../apps/web/src/app/(app)/dashboard/page.tsx>) | Currency-safe metrics and recent transactions |

## Database migrations

There are three append-only migrations:

- `0000_acoustic_the_order.sql`
  - Creates households, people, financial accounts, account ownership, and Milestone 1 constraints.
- `0001_yielding_morlocks.sql`
  - Creates import status/kind/decision enums.
  - Creates `import_sessions`, `import_files`, `import_candidates`, and `transactions`.
  - Adds household/account/session/candidate indexes, count/currency/amount checks, source-candidate uniqueness, and cascade/restrict behavior.
- `0002_hot_morlun.sql`
  - Hardens within-household provenance with composite session/file/candidate unique keys and foreign keys.
  - Ensures a candidate file and a transaction source candidate belong to the same import session.

Apply committed migrations with:

```bash
pnpm db:migrate
```

The generated `0002` SQL was inspected and reordered before first use so referenced composite unique constraints are created before their foreign keys. PGlite applies the full migration chain in every database integration test.

## Tests passing

The following commands passed on 2026-08-08 after Milestone 2 implementation:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Current Vitest coverage totals 48 tests:

- 25 domain tests, including strict CSV syntax/limits, explicit date formats, signed and debit/credit amounts, invalid rows, zero values, fingerprints, and exact/probable duplicate classification.
- 14 PostgreSQL integration tests, including Milestone 1 household isolation plus complete CSV lifecycle, cross-household rejection, deterministic import/candidate/transaction pagination, dashboard totals, existing, within-session, and stale-review duplicates, idempotent commit/rollback, session provenance, and upload throttling.
- 7 web tests for environment validation, upload-boundary validation, multi-file parsing, and currency/date display formatting.
- 2 branding tests.

The existing six Playwright checks cover the credential-free landing page in desktop/mobile Chromium, viewport overflow, and response security headers. Authenticated import browser automation remains unavailable without disposable Clerk credentials and a disposable PostgreSQL environment.

## Security properties added in Milestone 2

- Every import Server Action resolves the signed-in allow-listed Clerk user and active household before repository access.
- CSV upload actions authorise the household before decoding and parsing file content; the framework and application body limits bound unauthenticated and authenticated request volume respectively.
- IDs, mappings, decisions, file metadata, CSV structure, sizes, row counts, field lengths, dates, descriptions, and amounts are boundary-validated.
- React/Astryx render imported descriptions as text; imported CSV content is never executed as HTML, SQL, shell input, or a file path.
- Drizzle parameterises queries; composite foreign keys enforce household and session provenance.
- Upload volume is bounded by file/session limits and ten new sessions per household per rolling hour.
- Commit/rollback state transitions lock the session row, and commit also locks the target account before its current-transaction recheck, preventing duplicate commits, decision/commit races, and stale cross-session duplicate insertion.
- Raw file bytes are discarded after parsing; no public object URLs or document-download endpoints exist.

## Known limitations

- Real two-user sign-in, import, decision, commit, transaction, dashboard, and rollback flows have not been exercised against Clerk and hosted PostgreSQL because credentials are absent in this workspace.
- Authenticated Playwright coverage still requires disposable Clerk testing credentials and a disposable PostgreSQL database.
- CSV input is decoded as UTF-8 and supports comma delimiters only. The parser does not auto-detect semicolon/tab delimiters, text encodings, bank-specific preambles, or locale decimal separators.
- Date mapping supports exactly `DD/MM/YYYY`, `MM/DD/YYYY`, and `YYYY-MM-DD`.
- Amount mapping accepts plain decimal values, optional thousands commas, sign, or accounting parentheses; currency symbols must not be embedded in amount cells.
- One import session targets one financial account and therefore one currency. Multiple files in that session must all belong to that account.
- Original CSV bytes are not retained. Bounded parsed rows are stored in PostgreSQL JSONB until a future retention/deletion milestone defines cleanup policy.
- Probable duplicate detection is intentionally conservative: same account, identical minor-unit amount, and date distance of at most three days. There is no fuzzy merchant-name model.
- A rolled-back import is an immutable audit record and cannot be recommitted. Start a new import session instead.
- Transactions currently support committed-ledger pagination only; search, filters, manual editing, categories, transfers, and recurring rules are not implemented.
- Dashboard metrics are all-time cash-flow totals by currency. There are no date filters, budgets, charts, category breakdowns, or exchange-rate conversion.
- PostgreSQL row-level security is not enabled. Isolation remains application scoping plus composite relational constraints, so the deployment database credential must be private and least-privilege.
- The application has not been deployed to Vercel or connected to Supabase.
- `pnpm audit --audit-level high` currently reports `js-yaml@4.3.0` through ESLint and `nanoid@3.3.16` through PostCSS/Vite. Koshara does not import either package, and the reported vulnerable YAML parsing and zero-size custom-generator APIs are not exposed to CSV input or application requests. Upgrade the owning toolchain packages when they adopt the patched transitive releases and re-review this reachability assessment by 2026-09-08.

## Exact next milestone

**Milestone 3: PDF statement imports and private document storage.**

Milestone 3 should:

- Add secure PDF upload with magic-byte/type/size validation and bounded processing.
- Store original PDF statement objects in a private Cloudflare R2 bucket with household-scoped metadata and checksums.
- Support password-protected statements without persisting or logging PDF passwords.
- Extract statement rows into the existing import-session mapping/review/duplicate/commit/rollback pipeline rather than creating a parallel transaction path.
- Add private, short-lived authorised document access where operationally required; no public bucket/object URLs.
- Add synthetic unit, integration, and authenticated user-flow coverage for PDF validation, extraction failure, password handling, R2 metadata, candidate review, commit, and rollback.
- Update security, deployment, retention, and recovery documentation for stored statement documents.

Milestone 3 must not introduce Gmail discovery/OAuth, category management, recurring detection, export, exchange-rate conversion, or household deletion. Those remain later milestones.
