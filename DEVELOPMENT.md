# Development

## Prerequisites

- Node.js 22 or newer
- pnpm 11.9.0 or newer
- Google Chrome for the configured Playwright projects

Install and start the app:

```bash
pnpm install
pnpm dev
```

No `.env` file, database, authentication tenant, storage bucket, or Google project is required.

## Workspace commands

Run these from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

The first four commands run against the pnpm workspace. Browser tests start the Next.js development server and cover desktop and mobile Chrome.

## Source map

- `apps/web/src/app`: routes, root runtime, and app-level styles.
- `apps/web/src/components`: Astryx-based UI and WebMCP registration.
- `apps/web/src/lib/koshara-store.ts`: local state, validation, mutations, and persistence.
- `apps/web/src/lib/koshara-seed.ts`: synthetic rolling demo dataset.
- `apps/web/src/lib/webmcp-tool-registry.ts`: structured tool schemas and handlers.
- `apps/web/e2e`: browser and security-header coverage.
- `apps/web/public`: static demo assets, including the synthetic statement.

## Data during development

The store uses the browser key `koshara.finance.v1`. Use the application's reset control or clear the site's local storage to return to the seed data.

Do not add real financial statements, account identifiers, credentials, mailbox data, or local-storage exports to fixtures or screenshots. The committed PDF is synthetic and visibly labelled.

## UI changes

`AGENTS.md` is the Astryx implementation contract. Discover primitives before changing interface code:

```bash
pnpm exec astryx build "<interface idea>"
pnpm exec astryx template <name> --skeleton
pnpm exec astryx component <Name>
```

Use Astryx components for structure and interaction, design tokens for custom CSS, and verify both desktop and mobile behavior.

## Dependency changes

Add runtime dependencies to `apps/web/package.json`; keep repository-only tooling at the root. Regenerate `pnpm-lock.yaml` with `pnpm install` and run the complete quality checks before committing.
