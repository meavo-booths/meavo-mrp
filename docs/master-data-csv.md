# Master data CSV import / export

Meavo MRP accepts the same column layout as the [master Google Sheet](https://docs.google.com/spreadsheets/d/1YGDc0uuDF9DhSOV19JYceXqPmIL8tFfCmMNwlV0JwGQ/edit).

## Import order

1. **Materials** — `/materials`
2. **Elements** — `/recipes` (recommended before BOM)
3. **ElementBOM** — `/recipes`
4. **OpeningStock** — `/inventory`

## Tab columns

### Materials

| Column | Required | Notes |
|--------|----------|-------|
| `code` | Yes | Unique |
| `name` | No | Defaults to `code` if empty |
| `unit` | No | One of `бр`, `квм`, `м`, `л`, `кг` (aliases like `kg`, `m2` are normalized on import). Defaults to `бр` on insert |
| `unit_price_eur` | No | EUR per unit for BOM cost |

### Elements

| Column | Required | Notes |
|--------|----------|-------|
| `booth_model` | Yes | e.g. Soho |
| `sheet_header` | Yes | Exact `Опаковане` column label (**may contain line breaks** — keep when exporting from Google Sheets) |
| `simple_name` | Yes | Used in ElementBOM `element` column |
| `sort_order` | No | |
| `active` | No | TRUE/FALSE |

### ElementBOM

| Column | Required | Notes |
|--------|----------|-------|
| `booth_model` | Yes | |
| `colour` | No | Empty = all colours |
| `market` | No | Empty = US **and** non-US; `default` = non-US only; `US` = US only |
| `element` | Yes | Must match `simple_name` |
| `material_code` | Yes | Unknown codes are skipped with warning |
| `quantity` | Yes | |
| `notes` | No | Not imported |

**Replace rule:** each `booth_model` in the file replaces all existing BOM lines for that model.

**Conflicts:** mixing blank and specific `colour` or `market` on the same `(element, material_code)` aborts import for that model.

### OpeningStock

| Column | Required | Notes |
|--------|----------|-------|
| `material_code` | Yes | |
| `warehouse` | Yes | `AKS`, `VAR`, `KAZ`, or `TOP` |
| `quantity` | No | **Blank = skip row** (uncertain counts) |
| `count_date` | No | `YYYY-MM-DD`, `DD/MM/YYYY`, `DD.MM.YYYY`, or `8 Jun 2026` |
| `counted_through_batch` | No | Production checkpoint — physical stock reflects batches through this one (inclusive). Later batches are subtracted when production sync runs. |
| `notes` | No | |

## Warehouses

| Sheet code | App warehouse |
|------------|---------------|
| AKS | Аксаково |
| VAR | Варна |
| KAZ | Казанлък |
| TOP | Тополи |
