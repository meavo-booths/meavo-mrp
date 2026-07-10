# Agent guide — meavo-mrp

Quick orientation for AI agents working in this repo. Read this before exploring blindly.

**Cursor:** `.cursor/rules/core.mdc` and `security.mdc` are always applied. `ui.mdc`, `domain.mdc`, and `api.mdc` apply when editing matching paths.

## What this repo does

Meavo MRP (`mrp.meavo.app`) — Bulgarian-first PWA for the stock team: materials master data, per-warehouse stock balances via an immutable movement ledger, booth BOM recipes with exceptions, manufacturing-batch tracking synced from Google Sheets, and a feature-flagged AI invoice scanner (Gemini) with Zeron ERP sync. Satellite app of [meavo-gateway](https://github.com/meavo-booths/meavo-gateway) — follows [org STANDARDS](https://github.com/meavo-booths/meavo-agent-templates/blob/main/STANDARDS.md) with deviations listed in `.cursor/rules/`.

## Stack

- Next.js 16 App Router (**webpack forced** — Serwist PWA doesn't support Turbopack), TypeScript strict, React 19
- Tailwind CSS 4 + **shadcn/ui (Radix)** in `src/components/ui/` — approved deviation from the org in-house kit
- Prisma 6 via `@meavo/db` (github:meavo-booths/meavo-db#v0.3.1) → shared Neon Postgres
- NextAuth v5, JWT sessions, Google SSO only (invite-only via gateway `ToolCardAccess`)
- `next-intl` (`bg` default, `en`), Vercel Blob storage, `@google/genai` (Gemini), Serwist service worker
- Vercel hosting (`fra1`), pnpm 9+, Node 22+

## First files to read

| Task | Start here |
|------|------------|
| Add/change a page | `src/app/[locale]/(app)/` — feature folders (`materials/`, `inventory/`, `batches/`, `recipes/`, `documents/`) |
| Add an API mutation | `src/app/api/` route handler → thin, calls `src/lib/` (no Server Actions in this repo) |
| Stock movements & balances | `src/lib/stock/movements.ts` (`applyMovement()`), `src/lib/stock/balances.ts` |
| BOM recipes / exceptions | `src/lib/stock/bom-match.ts`, `bom-recipe-view.ts`, `recipe-exceptions.ts` |
| Google Sheets batch sync | `src/lib/sheets/sync.ts` (`runSheetSync()`), `src/lib/google/sheets-client.ts` |
| Invoice extraction (Gemini) | `src/lib/extractor/` (`extractDocument()`), learning loop in `src/lib/learning/profile.ts` |
| Zeron ERP sync | `src/lib/zeron/` — adapter interface + `enqueueZeronSync()` in `queue.ts` |
| CSV import/export | `src/lib/import/`, routes under `src/app/api/import/` |
| UI text / translations | `messages/bg.json` (source of truth) + `messages/en.json` |
| Auth & access | `src/lib/auth.ts`, `src/lib/auth/session.ts`, `src/lib/api/guard.ts`, `src/middleware.ts`, `MRP_TOOL_CARD_ID` |
| DB schema | `node_modules/@meavo/db/prisma/schema.prisma` — **edit in meavo-db only** (`Mrp*` models) |
| Tests | N/A — no test suite; run `pnpm lint` + `pnpm typecheck` |

## Do NOT

- Edit the Prisma schema here — schema lives in [meavo-db](https://github.com/meavo-booths/meavo-db); bump the git tag in `package.json` instead
- Run `prisma db push` — shared DB; the script is intentionally disabled
- Write stock quantities directly — always go through `applyMovement()` (ledger `MrpStockMovement` is source of truth; `MrpStockBalance` is a cache)
- Call Zeron adapters directly from routes — use `enqueueZeronSync()` so every attempt is audited in `MrpSyncAttempt`
- Hardcode UI strings — every user-facing string goes through `next-intl` messages (`bg` + `en`)
- Skip `requireApiUser()` in an API route — middleware excludes `/api/*`, routes are NOT otherwise protected
- Expose Vercel Blob URLs — originals stream through `/api/documents/[id]/file` only
- Use Turbopack — `dev`/`build` must keep `--webpack` (Serwist)
- Extend the legacy invoice scanner without checking `isInvoiceScannerEnabled()` (`src/lib/features.ts`)
- Commit secrets or `.env.local`

## Commands

```bash
pnpm install        # runs prisma generate (schema from @meavo/db)
pnpm dev            # localhost:3000 → redirects to /bg
pnpm lint
pnpm typecheck
pnpm build          # prisma generate && next build --webpack
```

## Conventions

1. Domain logic in `src/lib/<area>/` — API routes stay thin: auth guard, Zod-validate, call lib, map errors to JSON.
2. Mutations are API route handlers called with client `fetch()`; read-heavy pages query Prisma directly in Server Components.
3. Guards: `requireSessionUser()` in pages/layouts, `requireApiUser()` in API routes, `isAuthorizedCronRequest()` in cron routes.
4. Server-only modules import `"server-only"`; env access goes through `src/lib/env.ts` (Zod-validated).
5. Mobile-first — the stock team is on phones; verify new pages at 375px and 1280px.

## Scoped task template (preferred from user)

```
Area/route: e.g. /inventory or /api/stock/receipt
Behaviour: [what should happen]
Reference: [doc or existing module, if any]
Out of scope: [auth / schema / other apps]
```

## Related docs

- [docs/architecture.md](docs/architecture.md) — stack, layout, data flow
- [docs/domain.md](docs/domain.md) — glossary, roles, statuses, mutation map
- [docs/data-model.md](docs/data-model.md) — `Mrp*` tables (owned here, defined in meavo-db)
- [CONTRIBUTING.md](CONTRIBUTING.md) — PR process
