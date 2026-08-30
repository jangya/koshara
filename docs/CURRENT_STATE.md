# Koshara current state

Last verified: 2026-08-09
Repository HEAD inspected before this milestone: `22b383f` (`feat: add reviewed CSV import workflow`)

Koshara has completed Milestone 4 in the current working tree. The Milestone 3 private PDF workflow now accepts explicitly selected Gmail PDF attachments discovered through a separate, minimum-scope Google OAuth connection. OAuth credentials are encrypted at rest, Gmail access remains household/user scoped, and no scheduling or broad mailbox ingestion was added. No real financial document, mailbox, Google identity, or household identity was used, and this workspace was not connected to Google or R2 for verification.

## What was completed

### Milestones 1 and 2 retained

- The Node.js 22+, pnpm, Next.js 16 App Router, React 19, Clerk Organisations, Drizzle, PostgreSQL, and Astryx architecture remains intact.
- Server-side verified-email allow-listing, active-organisation checks, household people/accounts, and composite tenant constraints remain the authorisation and persistence foundation.
- CSV files still use explicit column/date/amount mapping, candidate review, exact/probable duplicate decisions, atomic commit, complete rollback, and transaction provenance.
- Dashboard totals remain grouped by currency; no exchange-rate conversion is implied.

### Milestone 3 PDF imports and private documents

- One text-based PDF up to 10 MiB can be uploaded into an import session for one household financial account.
- Upload validation rejects empty files, invalid or unsafe filenames, non-`.pdf` names, MIME types other than `application/pdf`, and content without the `%PDF-` magic bytes. SHA-256 is calculated from the accepted bytes.
- Optional PDF passwords are limited to 256 characters, passed only to the in-memory parser worker, omitted from repository/storage inputs, and never logged or persisted.
- PDF.js extraction runs in a dedicated Node worker thread with bounded V8 heap/code/stack resources, captured and discarded worker output, a 15-second forced timeout, strict parser errors, disabled font rendering/Wasm, and a one-megapixel image limit.
- Extraction is bounded to 100 pages, 5,000 positional rows, 100 columns, 2,000 characters per field, and 2 MiB of extracted UTF-8 text. Parser responses are validated again before they cross the worker trust boundary.
- Extracted positional fields become ordinary staged import rows with generic `Column N` headers. They enter the existing mapping, candidate review, duplicate decision, commit, and rollback repositories; no parallel transaction path exists.
- Original accepted PDFs are written through the S3-compatible Cloudflare R2 API under opaque `households/<household UUID>/statements/<object UUID>.pdf` keys. Put/get/delete calls have 15-second abort signals. The storage interface exposes only put/get/remove operations and never constructs a public or presigned URL.
- PostgreSQL stores the private object key, content type, byte size, SHA-256 checksum, page count, extracted-text size, import-file/session provenance, and timestamps. Composite foreign keys and checks bind every document to its household, session, and file; the object-key check also requires its embedded household ID to match the metadata row.
- Storage occurs before the metadata transaction. A failed or ambiguous upload triggers best-effort object deletion; a metadata failure also deletes the object. Cleanup failures return controlled operator-facing errors without exposing provider details, passwords, credentials, or object URLs.
- Original documents are available only through `/documents/[importFileId]`. Each request re-authorises Clerk household access, performs a household-scoped metadata lookup, fetches the private object server-side, verifies byte length and SHA-256, and returns a non-cacheable attachment. R2 endpoints, bucket names, and object keys never reach the browser.
- The import UI was discovered with the Astryx CLI before implementation and uses Astryx form/layout primitives without hand-rolled layout elements, utility classes, raw CSS values, or public document links.

### Milestone 4 read-only Gmail discovery and manual import

- A separate Google web OAuth connection requests exactly `https://www.googleapis.com/auth/gmail.readonly`, offline access, explicit consent, and PKCE. It does not reuse Clerk sign-in credentials or request Google profile/OpenID, send, modify, label, or delete scopes.
- OAuth start generates a 256-bit state and PKCE verifier. PostgreSQL stores only the SHA-256 state digest plus an AES-256-GCM-encrypted verifier, scoped to the household, initiating Clerk user, exact redirect URI, ten-minute expiry, and one-time consumption. An HttpOnly SameSite cookie binds the initiating browser.
- The callback rejects redirect drift, unknown/duplicate parameters, missing/ambiguous code/error values, cookie mismatch, replay, expired state, changed Clerk user/household, and any granted scope other than the exact read-only Gmail scope.
- Before persistence, the Gmail profile email must match a verified address on the already allow-listed Clerk user. A mismatch revokes the newly issued Google credentials best-effort and stores nothing.
- Refresh and access tokens are independently encrypted with random-nonce AES-256-GCM. Authenticated context binds each envelope to its household, connection ID, and token kind, so copied/swapped/tampered ciphertext fails decryption. The 32-byte environment key is canonical-base64 validated and never enters PostgreSQL or the browser.
- Connections are unique per household/Clerk user. Every refresh, discovery, attachment claim, import, listing, and disconnect predicate carries both household and connected-user scope.
- Manual discovery is limited to one run per minute, at most 25 Gmail search results, no page-token traversal, 50 accepted PDF descriptors, 200 MIME parts per message, ten MIME levels, a 30-second overall deadline, eight-second request deadlines, and one retry for bounded transient failures.
- Discovery uses Gmail partial-response fields that omit ordinary message/attachment body data. PostgreSQL persists only immutable provider message/part/attachment IDs, PDF filename/type/size, received timestamp, state, and import provenance; it stores no subject, sender, headers, snippet, body, or attachment bytes.
- A user explicitly chooses a discovered PDF, target financial account, and optional transient password. Only then are bounded attachment bytes fetched and sent through the exact Milestone 3 filename/MIME/magic/checksum, parser-worker, private R2, mapping, candidate review, duplicate decision, commit, rollback, and authenticated download path.
- Provider message/part provenance is a database idempotency key. A row claim blocks concurrent duplicate imports; the final import-session link is written in the same PostgreSQL transaction as staged PDF metadata. Failures release the claim and reuse R2 compensation; a later explicit discovery resets abandoned claims older than 15 minutes.
- Disconnect attempts Google token revocation, then clears both encrypted tokens locally while retaining household-scoped discovery/import provenance. An unconfirmed provider revocation returns only fixed Google Account cleanup guidance.
- OAuth codes, tokens, encryption keys, provider error bodies, message content, and attachment bytes are never logged or returned by application code. All Google/parser/storage errors crossing the action boundary are fixed, non-provider messages.
- The Gmail UI was discovered through the Astryx CLI. It uses page Sections for the connection controls and an edge-to-edge Table for dense attachment rows, with keyboard-native links/buttons/forms and no raw layout elements, utility classes, or custom CSS.

No sample financial records, statements, mailbox content, provider fixtures containing real data, credentials, bucket URLs, OAuth codes, tokens, encryption keys, or passwords are committed.

## Architecture decisions

1. **PDF is another import source, not another transaction pipeline.** `import_files.source_type` distinguishes CSV and PDF, while mapping, candidate staging, duplicate review, commit, rollback, and provenance remain shared.
2. **The original object and parsed audit data have separate stores.** R2 holds immutable original PDF bytes privately; PostgreSQL holds household-scoped metadata and bounded extracted rows needed by the existing review workflow.
3. **The parser boundary is hostile.** PDF bytes and PDF.js output are untrusted. A constrained worker, strict limits, timeout, output schema, and generic errors prevent parser details from becoming trusted application state.
4. **Passwords are ephemeral.** A password exists only in the submitted form, upload value, and worker data long enough to open the PDF. It is not forwarded to R2, PostgreSQL, actions, errors, or logs.
5. **Object creation is compensation-safe.** Because R2 and PostgreSQL cannot share a transaction, the workflow writes the object first and compensates with deletion on ambiguous upload or metadata failure. A distinct cleanup error makes an orphaned private object an explicit operational condition.
6. **Private access is proxied, not delegated.** The application does not issue bearer-style presigned URLs. Operational download goes through a fresh authenticated household check and an integrity-checked, `private, no-store` response.
7. **Tenant isolation is layered.** Server Actions authorise before parsing, repositories require `household_id`, document reads join by household, composite foreign keys preserve source provenance, and PostgreSQL checks the household namespace in every object key.
8. **Synchronous work is deliberately bounded.** The current implementation avoids a new queue or service. The 10 MiB/100-page/15-second limits keep request-time extraction finite until observed production demand justifies background processing.
9. **Gmail OAuth is separate and least-privilege.** Clerk remains Koshara identity; a dedicated Google client obtains only read-only Gmail access, and callback account matching prevents a signed-in user from attaching another person's mailbox.
10. **State is server-consumed, not merely signed.** A browser cookie plus household/user-scoped digest row, expiry, exact redirect, encrypted PKCE verifier, and one-time database transition prevent callback replay and cross-session substitution.
11. **Tokens are context-bound ciphertext.** Random-nonce AES-256-GCM envelopes authenticate the household, stable connection ID, and token kind. Access-token refresh updates only encrypted database values.
12. **Discovery and import are separate reads.** Discovery persists bounded PDF metadata only; attachment bytes remain at Google until the user selects Import PDF.
13. **Gmail is provenance, not a second PDF pipeline.** A selected attachment is claimed idempotently and handed to the existing PDF boundary. R2/PostgreSQL compensation and the shared transaction lifecycle remain authoritative.
14. **No scheduler is latent.** There is no cron route, queue, watch, push notification, history cursor, pagination loop, or `CRON_SECRET` use. Discovery starts only from the authenticated UI.

## Important files

| Area | File | Purpose |
| --- | --- | --- |
| PDF upload/parser boundary | [`apps/web/src/lib/pdf-import.ts`](../apps/web/src/lib/pdf-import.ts) | Upload validation, checksums, worker limits, controlled errors |
| Parser worker | [`apps/web/src/lib/pdf-extraction-worker.mjs`](../apps/web/src/lib/pdf-extraction-worker.mjs) | Bounded PDF.js positional extraction |
| Private storage | [`apps/web/src/lib/private-document-storage.ts`](../apps/web/src/lib/private-document-storage.ts) | Private R2 put/get/remove adapter |
| PDF workflow | [`apps/web/src/lib/pdf-import-service.ts`](../apps/web/src/lib/pdf-import-service.ts) | Extraction, object storage, metadata staging, compensation |
| Authenticated access | [`apps/web/src/app/(app)/documents/[importFileId]/route.ts`](<../apps/web/src/app/(app)/documents/[importFileId]/route.ts>) | Household-authorised, integrity-checked attachment response |
| Import actions | [`apps/web/src/app/(app)/import-actions.ts`](<../apps/web/src/app/(app)/import-actions.ts>) | Authenticated CSV/PDF workflow mutations |
| Database schema | [`packages/database/src/schema.ts`](../packages/database/src/schema.ts) | Document metadata and provenance constraints |
| Shared repositories | [`packages/database/src/import-repositories.ts`](../packages/database/src/import-repositories.ts) | Unified CSV/PDF import lifecycle |
| PDF integration tests | [`packages/database/src/documents.integration.test.ts`](../packages/database/src/documents.integration.test.ts) | Metadata isolation, provenance, staging, commit, rollback |
| OAuth/token handling | [`apps/web/src/lib/google-oauth.ts`](../apps/web/src/lib/google-oauth.ts) | Exact-scope web-server exchange and refresh |
| OAuth state | [`apps/web/src/lib/gmail-oauth-state.ts`](../apps/web/src/lib/gmail-oauth-state.ts) | State, digest, PKCE, strict callback parsing, cookie comparison |
| Token encryption | [`apps/web/src/lib/gmail-token-crypto.ts`](../apps/web/src/lib/gmail-token-crypto.ts) | Context-bound AES-256-GCM envelopes |
| Gmail API boundary | [`apps/web/src/lib/gmail-api.ts`](../apps/web/src/lib/gmail-api.ts) | Bounded profile, discovery, attachment, and revocation HTTPS calls |
| Gmail actions | [`apps/web/src/app/(app)/gmail/gmail-actions.ts`](<../apps/web/src/app/(app)/gmail/gmail-actions.ts>) | Authenticated discovery, disconnect, and manual import orchestration |
| OAuth routes | [`apps/web/src/app/(app)/gmail/oauth`](<../apps/web/src/app/(app)/gmail/oauth>) | Authorisation redirect and strict callback handlers |
| Gmail repositories | [`packages/database/src/gmail-repositories.ts`](../packages/database/src/gmail-repositories.ts) | State consumption, connection scoping, throttling, provenance, claims |
| Gmail integration tests | [`packages/database/src/gmail.integration.test.ts`](../packages/database/src/gmail.integration.test.ts) | Replay, isolation, idempotency, atomic linking, disconnect, recovery, rate limit |

## Database migrations

There are six append-only migrations:

- `0000_acoustic_the_order.sql`: household, people, financial accounts, ownership, and Milestone 1 constraints.
- `0001_yielding_morlocks.sql`: import sessions/files/candidates/transactions and lifecycle enums.
- `0002_hot_morlun.sql`: composite household/session/file/candidate provenance constraints.
- `0003_flimsy_photon.sql`:
  - Adds the `import_source_type` enum and non-null `import_files.source_type` with a backwards-compatible `csv` default.
  - Creates `statement_documents` with bounded metadata, checksum, content-type, and household-object-key checks.
  - Adds unique object/file constraints, a household/checksum index, and a composite `(household_id, import_session_id, import_file_id)` foreign key to `import_files`.
- `0004_good_mathemanic.sql`:
  - Adds `gmail_attachment_status`, one-time `gmail_oauth_states`, encrypted `gmail_connections`, and `gmail_attachments`.
  - Adds household/user connection uniqueness, provider provenance uniqueness, attachment/import state checks, exact read-only scope checks, encrypted/disconnected credential-state checks, and composite household foreign keys.
- `0005_zippy_argent.sql`: adds `gmail_connections.last_discovery_at` for transactional one-minute discovery throttling.

The generated `0003`–`0005` SQL and snapshots were inspected. `pnpm db:generate` reports no schema drift, and PGlite applies the complete chain in integration tests. Apply migrations with `pnpm db:migrate`; never rewrite a migration already used by a shared environment.

## Verification

The following commands passed on 2026-08-09 after Milestone 4 implementation:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
pnpm audit --audit-level high
```

Vitest coverage totals 98 tests:

- 25 domain tests for strict CSV parsing, mapping, amounts/dates, fingerprints, and duplicate classification.
- 24 PostgreSQL integration tests for household isolation, account ownership, CSV/PDF lifecycle, Gmail state replay/expiry, encrypted connection isolation, provider idempotency, atomic Gmail/import provenance, claim release/recovery, disconnect retention, pagination, stale review, and throttling.
- 47 web tests, including upload/MIME/name/magic/checksum validation, real extraction of programmatically generated synthetic PDFs, malformed/limit/timeout failures, encrypted PDF password handling, R2 compensation, OAuth state/callback/PKCE validation, token tamper/context rejection, exact-scope exchange/refresh, bounded Gmail provider responses/retries, account mismatch revocation, environment validation, and landing auth states.
- 2 branding tests.

All six credential-free Playwright checks pass in desktop/mobile Chromium for the landing page, viewport bounds, and response security headers. Authenticated Gmail browser automation was not run because a complete disposable Google + Clerk + PostgreSQL + private R2 environment was not available; no real identity, mailbox, or document was substituted.

The production build contains a dedicated bundled PDF worker plus dynamic Gmail, OAuth connect/callback, and `/documents/[importFileId]` routes. No manual output-tracing exception is required.

## Security properties

- Authentication and household authorisation happen before multipart file bytes are decoded or parsed.
- Request bodies are capped at 11 MiB by Next.js; the PDF boundary is stricter at one 10 MiB file.
- Filename, extension, exact MIME, PDF magic bytes, length, password length, checksum, parser pages/text/rows/columns/fields, worker time, and worker resources are bounded.
- PDF.js errors and worker stdout/stderr are not exposed or logged. Parser output is schema-validated before persistence.
- R2 configuration is server-only and validated. The endpoint must match the configured account's HTTPS `r2.cloudflarestorage.com` endpoint, and every storage call has a 15-second abort signal.
- R2 writes omit public ACLs. Application code exposes no bucket/object URL or presigned-URL capability.
- Every metadata lookup is household-scoped; database constraints prevent cross-household object namespaces and cross-session file provenance.
- Authenticated downloads re-check content length and SHA-256 and use `Content-Disposition: attachment`, `Content-Type: application/pdf`, `nosniff`, and `private, no-store`.
- Provider/parser/database error details and transient passwords are replaced with fixed messages at the action boundary.
- The existing CSV candidate/duplicate/commit/rollback locks and transaction provenance remain unchanged for PDF-derived rows.
- OAuth state, callback redirect/query shape, browser cookie, PKCE verifier, granted scope, authenticated Clerk user/household, and Gmail profile account are all independently validated before token persistence; OAuth redirects use a `no-referrer` policy.
- Every stored access/refresh token is AES-256-GCM encrypted with authenticated household/connection/type context; only encrypted envelopes reach repository inputs.
- Gmail discovery/import/disconnect is household and connected-user scoped, explicitly triggered, throttled, response/attachment bounded, idempotent, compensation-safe, and provider-detail redacted.
- Message subjects, senders, snippets, bodies, headers, and attachment bytes are not persisted. Discovery partial fields omit body data; manual inline attachment data is transient and never returned/logged.

## Dependency audit

- Added exact production dependencies `@aws-sdk/client-s3@3.1106.0` and `pdfjs-dist@6.2.108`. Both are Apache-2.0 licensed and support the repository's Node.js 22 runtime.
- The AWS client supplies the documented S3-compatible R2 operations; PDF.js is the maintained parser used directly in the constrained worker. No URL-signing, OCR, queue, antivirus, or storage abstraction package was added.
- pnpm's supply-chain policy passes. The exact AWS client release is listed in `minimumReleaseAgeExclude` so the intentional version remains reproducible; future upgrades should remove that exception once the configured age window has elapsed.
- The audit initially found high-severity transitive `js-yaml` and `nanoid` advisories in ESLint/Next/Vite tooling. Workspace overrides now pin patched `js-yaml@4.3.1` and `nanoid@3.3.17` without changing application APIs.
- Final `pnpm audit --audit-level high` result: no known vulnerabilities.

## Known limitations and operations

- Extraction supports text-based PDFs only. Scanned/image-only statements need OCR, which is intentionally not implemented. Complex tables, unusual text positioning, and unsupported encryption can produce generic positional rows or a controlled parse failure.
- Extracted columns are positional, not bank-specific. Users must map fields explicitly, and bank preambles/header lines may stage as invalid candidates that remain excluded.
- PDF extraction is synchronous and limited to one PDF per import session. It is not a background job and does not retry automatically.
- V8 worker limits do not provide operating-system process isolation. The layered byte/page/image/text/row/time limits reduce exposure, but PDF parsing should remain patched and monitored.
- The original PDF remains after transaction rollback because rollback reverses financial transactions, not the retained import audit document.
- No retention schedule, user-facing document deletion, orphan reconciler, malware scanner, content-disarm process, or household erasure workflow exists yet. On `DOCUMENT_CLEANUP_FAILED`, an operator must compare private R2 keys under the affected household prefix with `statement_documents.object_key` and remove only unreferenced objects.
- R2 credentials, private-bucket policy, and real object round trips were not integration-tested in this workspace. Deployment must disable public access and use bucket-scoped credentials.
- PostgreSQL row-level security is not enabled. Isolation is application scoping plus composite relational constraints, so the deployment credential must remain private and least-privilege.
- Authenticated multi-user PDF upload/download/review/commit/rollback browser flows still require fully disposable Clerk, PostgreSQL, and R2 resources.
- Google OAuth consent/verification, live token exchange/refresh/revocation, real Gmail partial responses, and authenticated Gmail-to-R2 browser flows were not exercised because fully disposable Google/Clerk/PostgreSQL/R2 resources were unavailable.
- `gmail.readonly` is a restricted Google scope. Production use may require Google verification/security assessment, and provider-side token invalidation currently surfaces on the next explicit action; Cross-Account Protection is not implemented.
- Gmail discovery intentionally examines only the first 25 query matches and does not paginate. It has no sender/bank filters, OCR, scheduled runs, Gmail watch/history processing, or background queue.
- An unconfirmed disconnect clears local ciphertext and instructs the user to revoke Koshara in Google Account settings. The application cannot retry revocation after intentionally removing its local token.
- Categories, recurring detection, export, exchange-rate conversion, retention deletion, and household deletion remain unimplemented.

## Exact next milestone

No Milestone 5 contract is specified elsewhere in the repository. Define and document that contract before further feature development. Categories, recurring detection, exports, exchange-rate conversion, retention/household deletion, scheduled Gmail discovery, broad mailbox ingestion, watches/push, and background processing remain explicitly out of scope until then.
