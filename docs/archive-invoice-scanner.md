# Archived: OCR invoice scanner MVP

The original Meavo MRP flow (photograph invoice → Gemini extraction → review → Zeron export)
is preserved in git and behind `ENABLE_INVOICE_SCANNER=false` (default).

## Git tag

When tagged: `ocr-invoice-scanner-mvp`

```bash
git checkout ocr-invoice-scanner-mvp
```

## Env vars (legacy flow)

- `GEMINI_API_KEY`, `GEMINI_MODEL`
- `SUPABASE_BUCKET_ORIGINALS`, `SUPABASE_BUCKET_THUMBNAILS`
- `ZERON_ADAPTER`, `ZERON_*`

## Routes (when flag enabled)

| Route | Purpose |
|-------|---------|
| `/scan` | Capture / upload |
| `/documents` | List |
| `/documents/[id]` | Review |
| `/api/documents/*` | Upload, extract, approve |
| `/admin/zeron` | Sync admin |

Set `ENABLE_INVOICE_SCANNER=true` and `NEXT_PUBLIC_ENABLE_INVOICE_SCANNER=true` to re-enable.
