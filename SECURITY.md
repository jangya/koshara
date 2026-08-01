# Security

## Milestone 1 guarantees

- Clerk verifies sessions; Koshara independently enforces the server-side email allow-list and active organisation membership.
- Protected pages and every Server Action perform their own authorisation checks.
- Every database query is scoped with an application-resolved household id.
- Composite household foreign keys reject cross-household account ownership at the database boundary.
- Zod validates mutation inputs. Drizzle issues parameterised queries.
- Complete account numbers are rejected; only masked references or last four digits are accepted.
- Clerk-managed CSP headers and standard response hardening headers are enabled.
- Production startup fails when required Milestone 1 secrets or configuration are absent.
- Secrets stay in server environment variables and are not logged or sent to browser code.

## Trust boundaries and limitations

`ALLOWED_USER_EMAILS` is a deployment-level comma-separated allow-list, not a user-management database. Changing it requires a deployment configuration update. An organisation owner must be allow-listed before inviting another address, and invitations are also checked against the same list.

The current database isolation model is application scoping plus database constraints; PostgreSQL row-level security is not enabled. The application therefore requires a private, least-privilege database credential. A compromised server credential could bypass application checks.

This milestone does not store statements, transaction data, Gmail tokens, PDF passwords, or R2 objects. Upload rate limiting, document validation, signed downloads, token encryption, destructive-operation audit records, export, and household erasure must be completed in the milestones that introduce those capabilities.

Koshara does not claim regulatory compliance, bank-grade security, end-to-end encryption, zero-knowledge design, or formal certification.

## Reporting

Do not open a public issue containing credentials or household data. Rotate exposed Clerk or PostgreSQL secrets immediately, remove affected sessions in Clerk, and investigate database access logs before restoring service.
