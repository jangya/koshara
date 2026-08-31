# Implementation Plan: Demo depth and category analytics

## Overview

Expand the browser-local demo workspace with deterministic history, then derive attention and category analytics from live transactions for Dashboard, Categories, prompts, and WebMCP. Preserve every manual, agent-created, and imported record.

## Architecture decisions

- Generate ten rolling calendar months from an explicit reference date, with stable month-based IDs and deterministic timestamps.
- Add missing seed rows only when an existing snapshot already contains demo data; never replace existing rows or seed production persistence.
- Keep analytics in pure functions shared by UI and WebMCP so both surfaces expose the same facts without hardcoded insights.
- Keep Categories URL-backed through the shared date-range control and show category details in an accessible Astryx collapsible group.
- Extend `get_spending_summary` additively rather than introducing a competing analytics tool.

## Task list

### Phase 1: Deterministic demo data

- [x] Add seed tests for determinism, idempotent merging, history/category coverage, review cases, and preservation of non-demo rows.
- [x] Replace the small seed with ten months of realistic synthetic INR activity and additive demo-only normalization.
- [x] Checkpoint: focused seed/store tests pass.

### Phase 2: Shared analytics contracts

- [x] Add failing tests for attention deduplication, category status/filter/sort, trends, merchants, recurring activity, and duplicates.
- [x] Implement pure category and attention summaries plus data-driven prompt selection.
- [x] Checkpoint: focused analytics and prompt tests pass.

### Phase 3: Product UI

- [x] Reorder Dashboard and add calm, date-aware needs-attention items with exact filtered links and prompts.
- [x] Rebuild Categories around overview metrics, URL date range, attention-first filters/sorting, compact inactive categories, and expandable details.
- [x] Checkpoint: web tests, lint, and typecheck pass.

### Phase 4: WebMCP and verification

- [x] Extend `get_spending_summary` with structured budgets, variance, review/uncategorized facts, trends, merchants, recurring activity, and duplicate groups.
- [x] Verify backward compatibility and new outputs with tests.
- [x] Run full tests, lint, typecheck, build, Astryx self-check, and real-browser desktop/mobile accessibility verification.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Seed migration modifies user data | High | Add only missing stable demo IDs; preserve all existing objects and never seed snapshots without demo rows. |
| Transfer/investment distort category health | Medium | Separate non-discretionary categories from ordinary spending analytics. |
| Category UI becomes too dense | Medium | Use flat rows, compact inactive section, and one-at-a-time collapsible details. |
| UI and WebMCP disagree | High | Share one pure analytics contract and test both consumers. |

## Verification

- Focused RED/GREEN tests after each slice.
- Full `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- Browser checks at desktop and mobile widths with console and accessibility-tree inspection.
