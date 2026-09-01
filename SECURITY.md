# Security

## Current guarantees

- The repository contains no authentication, database, mailbox, cloud-storage, or provider credentials.
- The app makes no Koshara-controlled server upload of statements or finance data.
- Seed records and the sample PDF are synthetic and contain no real financial information.
- Amounts are handled as integer minor units internally.
- Store mutations validate required values, supported enums, dates, references, and positive amounts.
- Statement rows proposed through WebMCP are checked and staged for human review before approval.
- The application sends a Content Security Policy plus referrer, MIME-sniffing, framing, permissions, and HSTS headers.
- Playwright verifies the public routes, responsive behavior, sample PDF, and key security headers in desktop and mobile Chrome.

## Local-storage model

Finance data is stored under `koshara.finance.v1` in the browser's local storage. It is not encrypted by Koshara and is accessible to scripts running on the same origin. Anyone with access to the browser profile or developer tools may be able to read or change it.

This model is appropriate only for the hackathon demo. Do not enter real financial or identity data. Clearing the site's browser data removes local changes, and there is no recovery or remote backup.

## External AI boundary

Koshara exposes structured browser tools but does not select, operate, or govern the external AI service. If a person gives a statement to an AI agent, that statement is handled under the agent provider's own privacy, retention, and security terms.

Use only the synthetic sample during the demo. If testing another statement, remove personal identifiers and understand the external provider's policy before sharing it.

Mutating tools are explicitly marked as non-read-only and validate their inputs. The statement workflow separates proposal from approval, but direct account, category, and transaction tools can still change local data. Use the reset control to recover the synthetic demo state.

## Before production use

Do not treat this architecture as production-ready. Adding Clerk, Supabase, Gmail, document parsing, or cloud storage would require, at minimum:

- server-enforced identity and authorization;
- tenant isolation and database row-level policies;
- schema migrations, backups, retention, deletion, and audit controls;
- strict upload limits and isolated hostile-document parsing;
- least-privilege OAuth, encrypted tokens, callback and replay defenses;
- secrets management, logging redaction, monitoring, and incident response;
- a fresh threat model, dependency audit, and end-to-end security testing.

Those systems are intentionally absent rather than partially configured.
