# Deployment

Koshara currently deploys as a self-contained Next.js demo. It needs no runtime secrets or external services.

## Recommended settings

- Repository root: the repository root, so the pnpm workspace and lockfile remain authoritative.
- Install command: `pnpm install --frozen-lockfile`.
- Build command: `pnpm build`.
- Node.js: 22 or newer.
- Output: the standard Next.js output detected by the hosting provider.

Vercel is the simplest target, but any platform that supports Next.js 16 and Node.js 22 can run the demo.

## Release checklist

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

After deployment, verify the landing page, all five finance pages, the sample PDF, responsive navigation, the WebMCP tools indicator, and the response security headers.

## Persistence limitation

All application data is stored in each visitor's browser. Deploying a new version does not migrate or back up that data, and different browsers or devices do not share it. Treat the deployment as a demo, not as a production financial record system.

Authentication, Supabase, Gmail, and cloud document storage require an explicit future migration plan before any related environment variables or provider configuration are added.
