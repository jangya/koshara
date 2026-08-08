# Security

## Milestone 2 guarantees

- Clerk verifies sessions; Koshara independently enforces the server-side email allow-list and active organisation membership.
- Protected pages and every Server Action perform their own authorisation checks.
- Every database query is scoped with an application-resolved household id.
- Composite household foreign keys reject cross-household account ownership at the database boundary.
- Zod validates mutation inputs. Drizzle issues parameterised queries.
- Complete account numbers are rejected; only masked references or last four digits are accepted.
- Clerk-managed CSP headers and standard response hardening headers are enabled.
- Production startup fails when required Milestone 1 secrets or configuration are absent.
- Secrets stay in server environment variables and are not logged or sent to browser code.
- CSV uploads are limited to five files, 2 MB and 5,000 rows per file, bounded columns/fields, accepted CSV names/types, and ten new sessions per household per rolling hour.
- Day/month order is explicit; descriptions and amounts are validated before candidate staging. Imported text is rendered through React and never executed as HTML, SQL, shell input, or a file path.
- Commit, duplicate-decision, and rollback transitions lock import-session rows. Commit locks the target account and returns stale new candidates to duplicate review before insertion. Transactions retain household/session/candidate provenance enforced by composite foreign keys.
- Original CSV bytes are discarded after parsing. Parsed rows remain private PostgreSQL data; no public object or download URL exists.

## Trust boundaries and limitations

`ALLOWED_USER_EMAILS` is a deployment-level comma-separated allow-list, not a user-management database. Changing it requires a deployment configuration update. An organisation owner must be allow-listed before inviting another address, and invitations are also checked against the same list.

The current database isolation model is application scoping plus database constraints; PostgreSQL row-level security is not enabled. The application therefore requires a private, least-privilege database credential. A compromised server credential could bypass application checks.

This milestone stores parsed CSV rows, import audit data, and committed transactions. It does not store original statement files, Gmail tokens, PDF passwords, or R2 objects. PDF validation, private document access, token encryption, broader destructive-operation audit records, export, retention cleanup, and household erasure must be completed in the milestones that introduce those capabilities.

Koshara does not claim regulatory compliance, bank-grade security, end-to-end encryption, zero-knowledge design, or formal certification.

## Reporting

Do not open a public issue containing credentials or household data. Rotate exposed Clerk or PostgreSQL secrets immediately, remove affected sessions in Clerk, and investigate database access logs before restoring service.
