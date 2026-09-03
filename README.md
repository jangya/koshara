# Koshara

Koshara is a local-first household finance demo built for a WebMCP hackathon. It gives a browser-based AI agent structured tools for reading and updating accounts, transactions, categories, budgets, spending insights, and staged statement imports.

[Live demo](https://koshara.vercel.app) · Demo video: `[ADD_YOUTUBE_URL]`

No credentials are required. The current demo intentionally has no authentication, backend, database, mailbox connection, or server-side document parser. Synthetic starter data and every change made during the demo are stored in the browser's local storage.

## Why WebMCP?

An external AI prepares structured work through Koshara's page-specific WebMCP tools. Koshara applies its rules and stages consequential changes, then the user reviews and completes them in the normal UI.

## Test the submission

### Dashboard insight and live chart configuration

1. Open the [live dashboard](https://koshara.vercel.app/dashboard) with a WebMCP-capable AI.
2. Use this prompt:

> Analyze the recent cash-flow trend and update the chart to highlight the most important spending insight. Do not modify any financial records.

### Statement parsing, staging, and human approval

1. Download the [synthetic demo statement](https://koshara.vercel.app/koshara_demo_credit_card_statement_june_2026.pdf), open [Statements](https://koshara.vercel.app/statements), and attach the PDF to a WebMCP-capable AI.
2. Use this prompt:

> Import the attached demo statement into Koshara as a staged review. First inspect the import context, then create an import session and stage all parsed transactions in one batch. Use existing accounts and categories, mark uncertain classifications as needs review, identify possible duplicates, and propose related transaction groups when appropriate. Do not create live transactions or approve the import. Return control to me for review in Koshara. Prefer WebMCP tools instead of browser automation.

The AI never approves the staged statement import. The user reviews it and completes approval through Koshara's UI.

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

A synthetic sample statement is available at [`/koshara_demo_credit_card_statement_june_2026.pdf`](https://koshara.vercel.app/koshara_demo_credit_card_statement_june_2026.pdf). It is clearly marked as demo data and contains no real account information.

## Quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

See [ARCHITECTURE.md](./ARCHITECTURE.md), [DEVELOPMENT.md](./DEVELOPMENT.md), [SECURITY.md](./SECURITY.md), and [DEPLOYMENT.md](./DEPLOYMENT.md) for the current implementation contract.
