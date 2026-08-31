# Implementation Plan: Recharts finance dashboard

## Overview

Polish the existing Astryx dashboard with Recharts while keeping the localStorage-backed Koshara store as the single authority for the UI and WebMCP. The work is limited to shared dashboard derivation, dashboard presentation, and responsive/runtime verification.

## Architecture decisions

- Derive every dashboard section from one pure calculation layer over `KosharaState` and the selected date range.
- Keep all transaction mutations in `koshara-store`; use its external-store subscription for immediate same-tab UI and WebMCP updates.
- Use Recharts only inside a client chart component. Astryx continues to own layout, cards, typography, controls, statuses, and theme tokens.
- Provide Combined, Spending, and Income chart modes so a salary spike cannot flatten expense detail.
- Preserve existing category-analysis work and WebMCP contracts; do not add a backend or competing design system.

## Task list

### Phase 1: Shared calculations

- [ ] Task 1: Add a single dashboard view-model builder.
  - Acceptance: summaries, comparisons, timeline, category budget usage/attention, balances, and recent transactions all derive from current state and range.
  - Verification: TypeScript and lint pass; inspect seeded August 2026 output through the running UI.

### Phase 2: Visualization

- [ ] Task 2: Install Recharts and replace the basic SVG timeline.
  - Acceptance: responsive area chart, gradients, currency axes/tooltip, accessible summary, empty state, and scale-preserving view control.
  - Verification: production build passes; browser shows no chart overflow or console errors.

### Phase 3: Dashboard composition

- [ ] Task 3: Recompose summary, attention, categories, accounts, and recent activity with Astryx.
  - Acceptance: requested desktop hierarchy, readable mobile stacking, textual statuses, brief value/update cues, and no clipped transaction content.
  - Verification: visual checks at 1440px, 1024px, and 390px.

### Phase 4: Live synchronization

- [ ] Task 4: Verify and, if needed, repair store update metadata.
  - Acceptance: create/edit/delete through the store path used by WebMCP updates all dashboard sections immediately and persists to localStorage.
  - Verification: create a temporary August 2026 transaction, confirm affected UI, delete it, and confirm restoration.

## Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Existing dirty dashboard/category work overlaps | High | Preserve current changes and make focused additive edits only. |
| Salary income obscures daily spending | Medium | Add a simple three-mode chart control with per-mode domains. |
| Recharts requires a measurable parent | Medium | Give the responsive container an Astryx-token height via a scoped chart class. |
| Mobile table clipping | Medium | Render an Astryx item list on narrow screens and the table only on wider screens. |

## Open questions resolved

- Unit tests are intentionally skipped per user request; lint, typecheck, build, browser, and mutation-path verification remain required.
- Existing Milestone 2 planning files are preserved; this task uses dashboard-specific plan files.
