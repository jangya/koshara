# Koshara

Koshara is a local-first household finance demo built for a WebMCP hackathon. It gives a browser-based AI agent structured tools for reading and updating accounts, transactions, categories, budgets, spending insights, and staged statement imports.

The current demo intentionally has no authentication, backend, database, mailbox connection, or server-side document parser. Synthetic starter data and every change made during the demo live in the browser's local storage.

## Run locally

Requirements: Node.js 22+ and pnpm 11.9+.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or external services are required.

The app stays in `apps/web`; the repository root owns workspace commands and Astryx tooling. This keeps the hackathon code simple without making a future second app or package migration harder.

## Demo flow

1. Open the landing page and dashboard.
2. Use the WebMCP tool indicator to inspect the tools exposed for the current page.
3. Ask a compatible AI agent to inspect spending, update finance data, or stage transactions from a statement.
4. Review staged rows on **Statements** before approving them.
5. Reset the demo from the UI when you need a clean local dataset.

A synthetic sample statement is available at `/koshara_demo_bank_statement_july_2026.pdf`. It is clearly marked as demo data and contains no real account information.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [DEVELOPMENT.md](./DEVELOPMENT.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the current implementation contract.
