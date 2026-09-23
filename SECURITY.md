# Security

## Current guarantees

- The repository contains no authentication, database, mailbox, cloud-storage, or provider credentials.
- The app makes no Koshara-controlled server upload of statements or finance data.
- Local PDF import reads digitally generated PDFs in the browser with PDF.js. PDF bytes and extracted text items stay in memory and are not stored, logged, sent to analytics, or passed to an AI service. The worker receives only the extracted positional text items for local reconstruction.
- Staging a local PDF saves normalized transaction fields, source page references, and a compact reconciliation result to the existing browser local-storage snapshot so review survives reloads. Clearing site data removes them. The statement UI has no analytics or session-replay integration.
- Seed records and the sample PDF are synthetic and contain no real financial information.
- Amounts are handled as integer minor units internally.
- Store mutations validate required values, supported enums, dates, references, and positive amounts.
- Statement rows proposed through WebMCP are checked and staged for human review before approval.
- The application sends a Content Security Policy plus referrer, MIME-sniffing, framing, permissions, and HSTS headers.
- Playwright verifies the public routes, responsive behavior, sample PDF, and key security headers in desktop and mobile Chrome.

## Local-storage model

Finance data is stored under `koshara.finance.v1` in the browser's local storage. It is not encrypted by Koshara and is accessible to scripts running on the same origin. Anyone with access to the browser profile or developer tools may be able to read or change it.

This local-storage model is intended for a single trusted browser profile. Staged transaction descriptions and amounts persist unencrypted after PDF import; clear site data to remove local changes. There is no recovery or remote backup.

## External AI boundary

Koshara exposes structured browser tools but does not select, operate, or govern the external AI service. If a person gives a statement to an AI agent, that statement is handled under the agent provider's own privacy, retention, and security terms.

Use only the synthetic sample during the demo. If testing another statement, remove personal identifiers and understand the external provider's policy before sharing it.

Mutating tools are explicitly marked as non-read-only and validate their inputs. The statement workflow separates proposal from approval, but direct account, category, and transaction tools can still change local data. Use the reset control to recover the synthetic demo state.

## Before production use

Do not treat this architecture as production-ready. Adding Clerk, Supabase, Gmail, document parsing, or cloud storage would require, at minimum:

- server-enforced identity and authorization;
- tenant isolation and database row-level policies;
- schema migrations, backups, retention, deletion, and audit controls;
- strict upload limits and further hostile-document parsing safeguards;
- least-privilege OAuth, encrypted tokens, callback and replay defenses;
- secrets management, logging redaction, monitoring, and incident response;
- a fresh threat model, dependency audit, and end-to-end security testing.

Those systems are intentionally absent rather than partially configured.
