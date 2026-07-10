# Architecture — meavo-mrp

Bulgarian-first PWA for the Meavo stock team at **mrp.meavo.app**: materials & stock ledger, booth BOM recipes, manufacturing-batch tracking synced from Google Sheets, and a feature-flagged AI invoice scanner with Zeron ERP sync.

**Further reading:**
- [domain.md](domain.md) — business rules, roles, mutation map
- [data-model.md](data-model.md) — database tables
- [AGENTS.md](../AGENTS.md) — quick orientation for AI agents

## Sibling repos (meavo-booths)

| Repo | Relationship |
|------|--------------|
| [meavo-db](https://github.com/meavo-booths/meavo-db) | Canonical Prisma schema (`@meavo/db` git dep). All `Mrp*` models are defined there; this repo only runs `prisma generate`. |
| [meavo-gateway](https://github.com/meavo-booths/meavo-gateway) | Owns identity: `User`, `ToolCard`, `ToolCardAccess`. Login requires a gateway user with access to the MRP tool card (`MRP_TOOL_CARD_ID`). |
| meavo-agent-templates | Source of org standards + these agent doc templates. |

Shared Neon Postgres — same `DATABASE_URL` as gateway. This app writes only `Mrp*` tables (plus `MrpUserProfile` and gateway `User`/`Account` rows created by NextAuth sign-in).

## Stack decisions

- **Next.js 16 App Router + React 19, TypeScript strict** — but `dev`/`build` force `--webpack` because `@serwist/next` (PWA service worker) doesn't support Turbopack yet.
- **Prisma 6 via `@meavo/db`** — `package.json` pins `"prisma": { "schema": "node_modules/@meavo/db/prisma/schema.prisma" }`; `db:push` is disabled (shared DB).
- **NextAuth v5, JWT, Google SSO only** — invite-only via gateway `ToolCardAccess`; no credentials login.
- **next-intl** — locales `bg` (default) and `en`, `localePrefix: "always"`, timezone Europe/Sofia. All pages live under `src/app/[locale]/`.
- **Tailwind 4 + shadcn/ui (new-york)** — approved deviation from the org in-house kit; MEAVO brand tokens in `globals.css`.
- **Gemini (`@google/genai`)** for document extraction with structured output; stubbed when `GEMINI_API_KEY` is absent.
- **Vercel Blob** for original document files, streamed through an authenticated route.
- **Serwist PWA** — `src/sw.ts` → `public/sw.js`, disabled in dev; installable on the stock team's phones.

## Repository layout

```
src/
├── app/
│   ├── [locale]/
│   │   ├── login/                 # public login (Google SSO)
│   │   └── (app)/                 # authenticated: requireSessionUser() in layout
│   │       ├── page.tsx           # home — stock balances
│   │       ├── materials/  inventory/  stock/receipt/
│   │       ├── batches/  batches/[id]/  recipes/
│   │       ├── scan/  documents/  documents/[id]/   # invoice scanner (flagged)
│   │       ├── electrics/         # placeholder
│   │       └── admin/zeron/       # sync attempt audit + retry
│   ├── api/                       # ALL mutations (no Server Actions)
│   │   ├── documents/  zeron/  sheets/
│   │   ├── materials/  warehouses/  stock/
│   │   ├── recipes/  recipe-exceptions/
│   │   └── import/                # CSV import/export/templates
│   └── manifest.ts                # PWA manifest
├── components/                    # ui/ (shadcn kit), header, feature components
├── i18n/                          # next-intl routing/request/navigation
├── lib/                           # domain logic (see domain.md)
├── middleware.ts                  # auth redirect + next-intl (excludes /api)
└── sw.ts                          # Serwist service worker
messages/bg.json, en.json          # translations (bg = source of truth)
```

## Data flow

```
Stock user (phone PWA / desktop)
   │ fetch()
   ▼
/api/* route handler ── requireApiUser() ── Zod validate
   │
   ▼
src/lib/<area>/  ──────────────▶ Prisma ──▶ shared Neon Postgres (Mrp* tables)
   │
   ├─ stock writes → applyMovement()  (MrpStockMovement ledger + MrpStockBalance cache)
   ├─ document approve → saveExtraction() + recordApprovedExtraction() + enqueueZeronSync()
   ├─ enqueueZeronSync() → adapter by ZERON_ADAPTER (stub | export=XLSX | api | agent)
   │                        each attempt audited in MrpSyncAttempt
   ├─ extractDocument() → Gemini (few-shot hints from MrpSupplierExtractionProfile)
   └─ uploads → Vercel Blob (mrp/originals/…), served via /api/documents/[id]/file

Vercel cron (every 2h) → /api/sheets/sync → runSheetSync()
   ← reads master "Статус на партиди" + per-batch "Опаковане" tabs (Google Sheets, service account)
   → upserts MrpManufacturingBatch / MrpBatchUnit / MrpBatchUnitElement
   → posts one-time stock deductions per completed element via applyMovement()
```

## API surface

REST route handlers only (no Server Actions). Main groups:

| Group | Routes |
|-------|--------|
| Documents (scanner) | `/api/documents` (+ `[id]`, `approve`, `reject`, `extract`, `file`) |
| Zeron | `/api/zeron/sync` (retry/dispatch) |
| Sheets | `/api/sheets/sync` (cron + admin manual) |
| Stock | `/api/stock/receipt`, `/api/stock/inventory`, `/api/stock/balances` |
| Master data | `/api/materials` (+ `[id]`), `/api/warehouses` |
| Recipes | `/api/recipes/[model]`, `/api/recipe-exceptions` (+ `[id]/revert`, `picker`) |
| CSV import | `/api/import/{materials,elements,element-bom,opening-stock}` + `templates/*` + `export/*` |
| Auth | `/api/auth/[...nextauth]` |

## Scheduled jobs

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/sheets/sync` | `0 */2 * * *` | Google Sheets → batches/units/elements sync + stock deductions (`maxDuration: 300`) |

## Environment variables

Names only (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Shared Neon Postgres (same as gateway) |
| `AUTH_SECRET`, `AUTH_URL` | NextAuth v5 |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google SSO (auth disabled if unset) |
| `MRP_TOOL_CARD_ID` | Gateway tool card gating login (`seed-mrp-tool`) |
| `GATEWAY_URL`, `NEXT_PUBLIC_APP_URL` | Cross-app links |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob |
| `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_THINKING_BUDGET` | Extraction (stubbed if key absent) |
| `ZERON_ADAPTER`, `ZERON_API_BASE_URL`, `ZERON_API_KEY`, `ZERON_EXPORT_EMAIL` | Zeron sync mode + config |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_SHEETS_MASTER_ID`, `GOOGLE_MASTER_DATA_SHEET_ID`, `GOOGLE_MASTER_DATA_BOM_GID` | Sheets sync |
| `CRON_SECRET` | Bearer auth for cron routes |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | Locale default (bg) |
| `ENABLE_INVOICE_SCANNER`, `NEXT_PUBLIC_ENABLE_INVOICE_SCANNER` | Legacy scanner feature flag |

## Deployment

Vercel project `meavo-mrp` (team meavo-gateway), region `fra1`, auto-deploy on push to `main`. `scripts/push-env-to-vercel.sh` pushes env vars from `.env.local`. See [deployment.md](deployment.md).
