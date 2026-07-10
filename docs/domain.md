# Domain reference — meavo-mrp

Business rules and **where to change what**. For stack see [architecture.md](architecture.md). For tables see [data-model.md](data-model.md).

## Glossary

| Term | Meaning |
|------|---------|
| Material | Raw material tracked for stock (`MrpMaterial`), unit + optional Zeron code, priced in EUR |
| Warehouse | Physical site — Аксаково, Варна, Казанлък (`MrpWarehouse`) |
| Movement | Signed quantity delta in the immutable ledger (`MrpStockMovement`); balances are a cache |
| Booth model / element | Booth product line (Soho, Camden…) and its checklist elements (Таван, Под…) from the batch sheet |
| BOM / recipe | Materials consumed per element per booth, filtered by colour + market (`MrpElementBomLine`) |
| Recipe exception | Named temporary BOM override (substitutions) scoped to models/colours/markets/batches |
| Manufacturing batch | Production run row synced from the master Google Sheet ("Статус на партиди") |
| Batch unit | One booth row on a batch's "Опаковане" (packing) tab, with per-element checkboxes |
| Document | Scanned invoice / proforma / delivery note (legacy scanner, feature-flagged) |
| Correction | Field-level diff between AI extraction and reviewer's value — feeds supplier learning |
| Zeron | The company's ERP; sync is pluggable (stub / XLSX export / API / agent) |
| Delivery zone | `local` (BG) / `eu` / `non_eu` — affects VAT handling and customs ref |

## Status / state values

| Entity | Statuses |
|--------|----------|
| `MrpDocument` | `pending_review → approved → synced / sync_failed`, or `rejected` |
| `MrpSyncAttempt` | `queued → running → succeeded / failed` |
| `MrpManufacturingBatch` | `planned / in_production / completed / cancelled` (derived from sheet) |
| `MrpRecipeException` | `active / reverted` |
| Movement types | `initial, manual_receipt, zeron_receipt, production_out, element_consumption, batch_complete_flush, inventory_count, bom_rework_adjustment` |

## Roles / personas

Roles live in `MrpUserProfile.role`, loaded by `getSessionUser()` (`src/lib/auth/session.ts`). Login itself requires a gateway `User` + `ToolCardAccess` for `MRP_TOOL_CARD_ID`.

| Role | Scope | Permissions (current enforcement) |
|------|-------|-----------------------------------|
| `scanner` (default) | All pages | Upload/scan documents, stock operations — most routes only require a session |
| `reviewer` | Documents | Intended for review/approve; not yet enforced separately in guards |
| `admin` | `/admin/zeron`, manual sheet sync | Only role actively checked: `POST /api/sheets/sync` requires `admin` (or `CRON_SECRET`) |

## Mutation map

| Change | Domain module | API route | Notes |
|--------|---------------|-----------|-------|
| Receive stock (manual/invoice) | `src/lib/stock/movements.ts` `applyMovement()` | `POST /api/stock/receipt` | Optional invoice number in metadata |
| Inventory count | `src/lib/stock/inventory.ts`, `inventory-batch.ts` | `POST /api/stock/inventory` | Writes `MrpInventoryCount` + variance movement |
| Create/edit material | `src/lib/import/materials.ts`, direct Prisma | `POST /api/materials`, `PATCH /api/materials/[id]` | `code` unique when set |
| CSV import (materials, elements, BOM, opening stock) | `src/lib/import/` | `POST /api/import/*` | Templates + exports under the same group |
| Recipe exception create/revert | `src/lib/stock/recipe-exceptions.ts` | `POST /api/recipe-exceptions`, `POST /api/recipe-exceptions/[id]/revert` | Scoped by model/colour/market/batch |
| Upload + extract document | `src/lib/extractor/` `extractDocument()` | `POST /api/documents`, `POST /api/documents/[id]/extract` | Blob upload, Gemini structured output |
| Review / save extraction | `src/lib/documents/save.ts` `saveExtraction()` | `PATCH /api/documents/[id]` | Logs `MrpCorrectionLog` per changed field |
| Approve document | `saveExtraction()` + `recordApprovedExtraction()` + `enqueueZeronSync()` | `POST /api/documents/[id]/approve` | Learning + sync in one flow |
| Retry Zeron sync | `src/lib/zeron/queue.ts` `enqueueZeronSync()` | `POST /api/zeron/sync` | Adapter from `ZERON_ADAPTER` |
| Batch/unit/element sync | `src/lib/sheets/sync.ts` `runSheetSync()` | `POST /api/sheets/sync` | Cron every 2h; idempotent; one-time deductions per completed element |

## Authorization

- Resolved in: `src/middleware.ts` (page redirects), `src/lib/auth/session.ts` (`requireSessionUser`), `src/lib/api/guard.ts` (`requireApiUser`), `src/lib/cron-auth.ts` (cron Bearer).
- Key rules agents get wrong without docs:
  - `/api/*` is NOT covered by middleware — every route needs its own guard.
  - Stock is double-entry-ish: never write `MrpStockBalance` or `MrpMaterial.currentQuantity` directly; `applyMovement()` keeps ledger and cache consistent.
  - Sheet-sync deductions are once-only via `MrpBatchUnitElement.deductionPosted` — breaking idempotency double-deducts stock.
  - The invoice scanner is feature-flagged (`isInvoiceScannerEnabled()`); its routes 404 when off.

## Legacy port index

The original invoice-scanner MVP (Supabase-based) is archived — see [archive-invoice-scanner.md](archive-invoice-scanner.md) and `supabase-schema-columns.csv`. It is documentation only; there is no legacy code subtree in this repo.
