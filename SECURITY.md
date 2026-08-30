# Security

## Milestone 4 guarantees

- Clerk verifies sessions; Koshara independently enforces the server-side email allow-list and active organisation membership.
- Protected pages, every Server Action, and the private document route perform their own authorisation checks.
- Database queries are household-scoped. Composite foreign keys/checks reject cross-household ownership, document namespaces, import provenance, and transaction provenance.
- Zod validates mutation inputs and parser output; Drizzle issues parameterised queries.
- CSV and PDF uploads are authorised before parsing and bounded at framework/application layers.
- PDF validation covers non-empty size, 10 MiB maximum, filename/extension, exact MIME, `%PDF-` magic bytes, checksum, 100 pages, 5,000 rows, 100 columns, field/text limits, and 15-second worker timeout.
- PDF.js runs with strict errors and constrained worker resources. Worker output and errors are treated as untrusted and are never rendered or persisted without validation.
- Protected-PDF passwords are transient, bounded, and absent from logs, R2, PostgreSQL, repository inputs, and user-visible provider errors.
- Original PDFs use opaque household-prefixed keys in a private R2 bucket. Storage operations have 15-second abort signals, and the application does not create public or presigned object URLs.
- Authenticated downloads re-authorise household access, verify stored length/SHA-256, return an attachment, disable caching, and set `nosniff`.
- Ambiguous/failed storage and metadata operations use compensating deletion. Cleanup failure is reported without leaking credentials, endpoints, keys, provider errors, or passwords.
- Existing candidate review, duplicate decisions, account/session locks, atomic commit/rollback, and source provenance apply unchanged to PDF-derived rows.
- Gmail uses a separate Google web OAuth client and requests exactly `https://www.googleapis.com/auth/gmail.readonly`; no send, modify, label, delete, broad mail, profile, or OpenID scope is requested.
- OAuth authorisation uses PKCE, offline access, explicit consent, a 256-bit random state, an HttpOnly SameSite cookie, a SHA-256 database digest, a ten-minute expiry, one-time consumption, an exact configured callback URI, and `no-referrer` OAuth redirects. Duplicate/unknown callback parameters, replay, changed users/households, account mismatches, extra scopes, and redirect drift fail closed.
- The connected Gmail profile address must match a verified email on the authenticated, allow-listed Clerk user. Connections, discovery, refresh, import, and disconnect are scoped by both `household_id` and `connected_by_clerk_user_id`.
- Access tokens, refresh tokens, and temporary PKCE verifiers use random-nonce AES-256-GCM envelopes with household/connection/token-kind authenticated context. The 32-byte base64 server key is validated and never persisted, logged, or sent to the browser.
- Manual discovery is limited to one request per connection per minute, 25 messages, 50 accepted PDF descriptors, 200 MIME parts per message, ten MIME levels, an overall 30-second deadline, per-request deadlines, and one bounded retry. It follows no mailbox result pagination and stores no subjects, snippets, bodies, headers, or attachment bytes.
- Attachment IDs/part IDs, filenames, MIME types, dates, sizes, base64url data, and provider JSON are untrusted and bounded. Bytes are fetched only after an explicit Import PDF action and must pass the exact PDF upload/magic/checksum/parser/storage pipeline.
- Gmail attachment provenance is idempotent per household/connection/message/part. Import claims prevent concurrent duplicate sessions, database staging links provenance atomically, failed imports release the claim, and a later manual discovery resets abandoned claims after 15 minutes.
- Disconnect attempts Google revocation and always removes locally stored encrypted credentials. If revocation cannot be confirmed, the UI gives a fixed instruction to remove Koshara in Google Account settings without revealing provider details.
- Application code never logs or returns OAuth codes, tokens, encryption keys, message contents, attachment bytes, raw Google responses, or provider error bodies.
- Complete account numbers remain rejected; only masked references or last four digits are accepted.
- CSP and standard response hardening headers remain enabled. Production startup fails when required configuration is absent.

## Trust boundaries and limitations

`ALLOWED_USER_EMAILS` is deployment configuration, not a user-management database. Changing it requires a deployment update. An organisation owner must be allow-listed before inviting another address, and invitations use the same allow-list.

PDF content, Gmail metadata/bytes, parser output, filenames, Google/R2 responses, and callback query values are untrusted. Koshara extracts text but does not execute embedded PDF content. Downloads are attachments; however, no antivirus, content-disarm, OCR, or operating-system process sandbox is present. Keep PDF.js patched and retain the documented bounds.

Database isolation is application scoping plus constraints; PostgreSQL row-level security is not enabled. Use a private, least-privilege database credential. R2 must have public access/custom domains disabled and credentials restricted to the single statement bucket.

No retention deletion, orphan-reconciliation job, or household erasure exists. A cleanup-failure response requires an operator to compare R2 keys with PostgreSQL metadata before deleting only unreferenced objects. Transaction rollback intentionally retains the source document and audit record.

Gmail read-only is a Google restricted scope and may require Google verification/security assessment before production use. The application has no push notifications, Cross-Account Protection receiver, scheduled discovery, provider audit-log ingestion, or automatic deletion of Gmail provenance. Provider-side revocation can happen at any time; affected operations fail with fixed reconnect guidance.

Koshara does not claim regulatory compliance, bank-grade security, end-to-end encryption, zero-knowledge design, malware-free documents, or formal certification.

## Reporting

Do not open a public issue containing credentials, OAuth codes, tokens, encryption keys, object keys, statements, message metadata, or household data. Rotate exposed Clerk, PostgreSQL, R2, Google OAuth, or Gmail encryption secrets immediately; revoke affected Google access and sessions; inspect provider/database access logs; reconcile unexpected objects; and restore service only after containment.
