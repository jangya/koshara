# Implementation Plan: Milestone 2 CSV imports

## Overview

Add a CSV-only import workflow that persists household-scoped import sessions, requires explicit column/date mapping, stages review candidates, resolves duplicate decisions, commits transactions atomically, supports complete rollback, and exposes real transaction/dashboard reads. PDF, object storage, Gmail, categories, and recurring analysis remain out of scope.

## Architecture decisions

- Keep orchestration in authenticated Next.js Server Actions, pure parsing/normalisation in `packages/domain`, and all persistence in household-scoped `packages/database` repositories.
- Persist bounded parsed CSV rows with import files so mapping can happen after upload without introducing Milestone 3 object storage.
- Model import states as `mapping -> review -> committed -> rolled-back`; only review sessions with no unresolved duplicate candidates can commit.
- Define an exact duplicate as equal account, date, minor-unit amount, and normalised description. Define a probable duplicate as equal account and amount within three calendar days with a different exact fingerprint.
- Retain import session/file/candidate records on rollback while deleting every transaction sourced from that session in the same database transaction.

## Task list

### Phase 1: Domain contract

- [x] Task 1: Add strict CSV parsing and per-file mapping contracts.
  - Acceptance: quoted CSV is deterministic; malformed/oversized input fails; date formats and amount modes are explicit; invalid rows become reviewable validation results.
  - Verification: new domain tests fail before implementation and pass after it.
- [x] Task 2: Add deterministic transaction fingerprints and duplicate classification.
  - Acceptance: exact and probable matches follow the documented rules; comparisons use integer minor units and calendar dates.
  - Verification: focused unit tests cover exact, probable, non-match, and within-session cases.

### Checkpoint: Domain

- [x] Domain lint, typecheck, and tests pass.

### Phase 2: Persistence lifecycle

- [x] Task 3: Add append-only Milestone 2 schema and migration.
  - Acceptance: import sessions/files/candidates and transactions are household-scoped; cross-household links are rejected; source candidate uniqueness prevents double insertion.
  - Verification: generated SQL is inspected and applies in PGlite.
- [x] Task 4: Add upload, mapping, review, decision, commit, and rollback repositories.
  - Acceptance: every query requires household id; state transitions reject invalid order; commit and rollback are atomic and idempotency-safe.
  - Verification: integration tests exercise a complete synthetic flow, duplicate blocking, isolation, commit, and rollback.

### Checkpoint: Persistence

- [x] Database lint, typecheck, and tests pass.

### Phase 3: Authenticated import workflow

- [x] Task 5: Add validated Server Action contracts for every workflow transition.
  - Acceptance: file count/size/type, ids, mappings, and decisions are boundary-validated; errors do not expose internals; every action resolves household access.
  - Verification: web typecheck and focused tests pass.
- [x] Task 6: Replace the import placeholder with upload/history, mapping, and candidate-review views.
  - Acceptance: users can upload multiple CSVs, map every file, inspect invalid/new/duplicate rows, explicitly decide duplicate rows, commit, and rollback; all controls are keyboard accessible.
  - Verification: production build passes and page structure follows discovered Astryx component contracts.

### Phase 4: Committed data surfaces

- [x] Task 7: Implement the transactions page from committed rows.
  - Acceptance: household transactions render as a dense edge-to-edge table with account, date, description, and signed amount; honest empty state remains.
  - Verification: repository integration tests and production build pass.
- [x] Task 8: Implement dashboard basics from committed rows only.
  - Acceptance: metrics and recent transactions are derived from household-scoped committed data; rollback removes their contribution.
  - Verification: dashboard summary integration tests and production build pass.

### Checkpoint: Complete

- [x] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- [x] Review the full diff for tenant isolation, raw HTML/layout violations, hardcoded styling values, secrets, and unrelated changes.
- [x] Update `docs/CURRENT_STATE.md` with delivered behavior, decisions, migrations, tests, limitations, and exact Milestone 3 scope.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| CSV memory/DB amplification | High | Cap files, bytes, rows, headers, and field lengths at both client and server boundaries. |
| Ambiguous dates | High | Require an explicit per-file date format; never infer day/month order. |
| Duplicate financial records | High | Integer minor-unit fingerprints, review-blocking duplicate decisions, transaction-bound commit. |
| Cross-household access | High | Composite foreign keys plus household id on every repository predicate. |
| Partial rollback | High | Delete sourced transactions and update session state in one database transaction. |
| Authenticated browser environment unavailable | Medium | Cover the end-to-end data lifecycle with PGlite and preserve credential-free build/e2e behavior. |

## Open questions resolved from repository evidence

- No separate original specification is present; `docs/CURRENT_STATE.md` is the detailed Milestone 2 contract.
- Raw CSV persistence is acceptable only for this bounded CSV milestone; original statement object storage remains deferred with PDF/R2.
- Category and recurring intelligence remain Milestone 4+ concerns, so dashboard basics use uncategorised cash-flow metrics.
