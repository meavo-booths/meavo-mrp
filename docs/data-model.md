# Data model — meavo-mrp

Canonical schema lives in **[meavo-db](https://github.com/meavo-booths/meavo-db)** (`prisma/schema.prisma`, section `// ---- Manufacturing / MRP (owner: mrp) ----`).

Local reference: `node_modules/@meavo/db/prisma/schema.prisma`

**Do not edit the schema in this repo** — this repo is a consumer. Workflow: change schema in meavo-db → tag release → bump the `@meavo/db` git ref in `package.json` → `pnpm install` (runs `prisma generate`). `db:push` is intentionally disabled here.

Pinned version: `github:meavo-booths/meavo-db#v0.3.1`

## Entity relationship

```
User (gateway) ──1:1── MrpUserProfile (role)
   │ createdBy/approvedBy
   ▼
MrpSupplier ──1:1── MrpSupplierExtractionProfile (hints, few-shot examples)
   │
   ├── MrpDocument ──< MrpLineItem
   │        ├──< MrpCorrectionLog        (field-level AI vs user diffs)
   │        └──< MrpSyncAttempt          (Zeron sync audit)
   │
MrpWarehouse ──< MrpStockMovement >── MrpMaterial
   │                (ledger)               │
   ├──< MrpStockBalance (cache) >──────────┤
   └──< MrpInventoryCount >────────────────┘
   
MrpBoothModel ──< MrpBoothElement ──< MrpElementBomLine >── MrpMaterial
   │                    │                    (colour/market-scoped recipe)
   │                    └──< MrpBatchUnitElement
   └──< MrpManufacturingBatch ──< MrpBatchUnit ──< MrpBatchUnitElement
                │                                     (checkbox + deductionPosted)
                └──< MrpRecipeExceptionBatchLink
MrpRecipeException ──< MrpRecipeExceptionScope / LineChange / BatchLink
```

## Core tables / models

### `MrpStockMovement` — the stock ledger

Immutable, signed quantity deltas per warehouse × material. **Source of truth for stock.** Written only by `applyMovement()` (`src/lib/stock/movements.ts`).

| Field | Notes |
|-------|-------|
| `movementType` | `initial`, `manual_receipt`, `zeron_receipt`, `production_out`, `element_consumption`, `batch_complete_flush`, `inventory_count`, `bom_rework_adjustment` |
| `quantityDelta` | Signed: positive = in, negative = out. `Decimal(18,4)` |
| `referenceId` / `metadata` | Free links (batch id, invoice number, …) |

### `MrpStockBalance` — on-hand cache

Per warehouse × material, updated in the same transaction as the movement. Never write directly. `MrpMaterial.currentQuantity` is a further denormalization for the default warehouse.

### `MrpMaterial` / `MrpWarehouse`

Materials master (optional unique Zeron `code`, `unit`, `unitPriceEur`) and physical sites (unique `code`). Managed via UI + CSV import (`src/lib/import/`).

### `MrpBoothModel` / `MrpBoothElement` / `MrpElementBomLine`

Booth product lines and their packing-checklist elements; BOM lines say which materials one element consumes, scoped by `colour` (null = all colours) and `market` (null = all; `default` = non-US; `US`). `MrpBomMissingMaterialCode` tracks BOM codes not yet in the materials master.

### `MrpManufacturingBatch` / `MrpBatchUnit` / `MrpBatchUnitElement`

Mirror of the Google Sheets production tracking: master-sheet batch rows (keyed `masterSheetRowKey`), per-booth rows from the batch "Опаковане" tab (keyed sheet row index), and per-element checkbox state. `deductionPosted` guarantees each completed element deducts stock exactly once. Sync audit in `MrpSheetSyncLog`.

### `MrpRecipeException` (+ `Scope`, `LineChange`, `BatchLink`)

Named temporary BOM overrides (`remove`/`add` material lines), scoped to models/colours/markets and optionally linked to specific batches or booths. Status `active` / `reverted`.

### `MrpDocument` / `MrpLineItem` — invoice scanner (feature-flagged)

Scanned document with extraction lifecycle: `rawAiExtraction` (untouched Gemini output), `confidence` map, `finalExtraction` (reviewed), `storageKey` (Vercel Blob), `contentHash` (dedupe). Status `pending_review → approved → synced / sync_failed`, or `rejected`.

### `MrpSupplier` / `MrpSupplierExtractionProfile`

Suppliers matched by VAT → EIK → `normalizedName` (`findOrCreateSupplier()`). The profile holds prompt `hints` and up to 5 FIFO `recentExamples` — the learning loop (`src/lib/learning/profile.ts`).

### `MrpCorrectionLog`

Every field-level edit a reviewer makes vs the AI value (`fieldPath` like `lineItems[2].unitPrice`). Mined into supplier hints once a correction repeats (threshold 3).

### `MrpSyncAttempt`

Audit of every Zeron push: adapter, status (`queued/running/succeeded/failed`), payload + response for replay. Written by `enqueueZeronSync()`.

### `MrpUserProfile`

App role (`scanner`/`reviewer`/`admin`) keyed by gateway `User.id`. Identity itself lives in gateway — never duplicate `User`.

## Shared models this app touches

- `User`, `Account` — created/updated by NextAuth Google sign-in (invite-only).
- `ToolCardAccess` — read at login to gate access (`MRP_TOOL_CARD_ID`).

## Sync / external copies

- **Google Sheets → DB**: batches/units/elements via `runSheetSync()`; sheet is the source of truth for batch data, DB mirrors it.
- **DB → Zeron**: approved documents pushed via adapter (`MrpSyncAttempt` audit); XLSX export is the current real-world path.
- **Blob**: original document files in Vercel Blob under `mrp/originals/…`, keyed by `MrpDocument.storageKey`.

## Queries agents should reuse

- Stock: `src/lib/stock/balances.ts`, `movements.ts`, `inventory.ts` — never raw SQL for stock.
- BOM/recipes: `src/lib/stock/bom-match.ts`, `bom-recipe-view.ts`, `bom-cost.ts`.
- Suppliers: `src/lib/suppliers/match.ts` (`findOrCreateSupplier`, `searchSuppliersByVatOrName`).
- Documents: `src/lib/documents/save.ts`; Prisma client singleton in `src/lib/prisma.ts`.
