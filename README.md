# Meavo MRP

> Bulgarian-first AI invoice scanner with Zeron ERP sync.

A responsive PWA for the stock team to:

1. Photograph (phone) or upload (desktop) invoices, proforma invoices,
   and delivery notes.
2. Have **Gemini 2.5 Flash** extract supplier, dates, line items, totals,
   VAT, and delivery zone (BG / EU / non-EU).
3. Review and correct the extraction side-by-side with the original
   document.
4. Approve and sync to **Zeron ERP** via a pluggable adapter (real API
   when available, XLSX/XML manual export as Plan B).

The app **learns from corrections** per supplier and feeds approved
examples back into the extraction prompt as few-shot context.

---

## Documentation

| Audience | Doc | What it covers |
| --- | --- | --- |
| First-time user | [`docs/accounts-checklist.md`](./docs/accounts-checklist.md) | Every account to create, in order, with cost. |
| First-time user | [`docs/oauth-setup.md`](./docs/oauth-setup.md) | Google Cloud OAuth client for NextAuth Google SSO. |
| First-time user | [`docs/domain-setup.md`](./docs/domain-setup.md) | One CNAME record for `stock.yourcompany.bg`. |
| Devops | [`docs/neon-setup.md`](./docs/neon-setup.md) | Shared MEAVO Neon DB, `@meavo/db` schema, tool-card access. |
| Devops | [`docs/deployment.md`](./docs/deployment.md) | Local dev + Vercel production deploy. |
| Stock team (Bulgarian) | [`docs/operator-guide-bg.md`](./docs/operator-guide-bg.md) | Кратко ръководство за оператори. |
| Devops | [`docs/zeron-outreach.md`](./docs/zeron-outreach.md) | Outreach emails + integration questionnaire for Zeron. |

---

## Quick start (local dev)

```bash
# Node 22+ recommended; pnpm 9+
pnpm install          # runs `prisma generate` from the shared @meavo/db schema
cp .env.example .env.local
# fill in DATABASE_URL (shared Neon), AUTH_*, BLOB_READ_WRITE_TOKEN, Gemini keys

pnpm dev
```

Open <http://localhost:3000> — the app redirects to `/bg` (Bulgarian) by
default. Switch to English from the language menu.

---

## Tech stack

- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind v4** + shadcn/ui (new-york style)
- **next-intl** for BG/EN i18n (default `bg`)
- **PWA** via `@serwist/next` — installable on iOS, Android, and desktop
- **Neon Postgres** — shared MEAVO database via [`@meavo/db`](https://github.com/meavo-booths/meavo-db)
- **Prisma ORM** for type-safe DB access (schema owned by `meavo-db`)
- **NextAuth** — Google SSO against the gateway `User` + tool-card access
- **Vercel Blob** — private original document storage
- **Google Gemini API** (`gemini-2.5-flash`) for vision extraction
- **Zod** schemas shared between extractor and review form
- **Vercel** (Frankfurt region) for hosting

---

## Repo layout

```text
src/
  app/
    [locale]/                 # bg | en — i18n-aware routes
      (app)/                  # authenticated app shell
        page.tsx              # home
        scan/                 # capture flow
        documents/            # list + review
        admin/zeron/          # sync admin
      login/                  # Google SSO sign-in
    api/                      # server-side routes
      auth/[...nextauth]/     # NextAuth (Google SSO)
      documents/...
      zeron/sync/route.ts
    manifest.ts               # PWA manifest
  components/
    ui/                       # shadcn/ui primitives
    auth/                     # login form
    scan/                     # capture-flow components
    documents/                # review form, image viewer, badges
    admin/                    # retry button etc.
  lib/
    auth/                     # NextAuth session helper
    prisma.ts                 # Prisma client singleton (@meavo/db schema)
    documents/                # save/approve helpers
    extractor/                # Gemini provider + zod schemas + prompts
    learning/                 # supplier profile updates
    suppliers/                # match-or-create supplier
    zeron/                    # adapter interface + 4 implementations + queue
    storage/                  # Vercel Blob storage helpers
    i18n/                     # (mirrored to src/i18n/ for plugin)
    utils/                    # cn, format, hash, sanitize-filename
  i18n/                       # next-intl routing + request config
  middleware.ts               # locale routing
  sw.ts                       # serwist service worker
messages/                     # bg.json (source of truth) + en.json
docs/                         # accounts, oauth, domain, neon, zeron, deploy, operator
public/icons/                 # PWA icons (generated from icon.svg via scripts/make-icons.mjs)
```

---

## NPM scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` | Local dev server (webpack — `@serwist/next` does not yet support turbopack) |
| `pnpm build` | Production build |
| `pnpm start` | Production start |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:generate` | `prisma generate` from the shared `@meavo/db` schema |

Schema changes are made in the [`meavo-db`](https://github.com/meavo-booths/meavo-db)
repo (the only repo allowed to alter the shared database), then the `@meavo/db`
dependency tag is bumped here.

---

## Deploy

Production: **[mrp.meavo.app](https://mrp.meavo.app)** (Vercel project `meavo-gateway/meavo-mrp`, Frankfurt region).

1. Fill `.env.local` from `.env.example` (shared Neon `DATABASE_URL`, `AUTH_*`, Blob token, Gemini keys).
2. Push secrets to Vercel: `bash scripts/push-env-to-vercel.sh`
3. In Google Cloud OAuth, add `https://mrp.meavo.app/api/auth/callback/google` to **Authorized redirect URIs**.
4. Pushes to `main` auto-deploy via the GitHub integration.

## Roadmap

- [x] **Phase 1 — MVP**: scaffold, i18n, capture, AI extraction, review UI,
      learning loop, delivery zone, Zeron stub + export adapter, sync admin
- [ ] **Phase 2**: phone-to-desktop QR handoff, multi-page PDFs,
      bounding-box overlays
- [ ] **Phase 3**: real Zeron API integration once vendor docs arrive,
      retries with exponential backoff, dashboard
- [ ] **Phase 4**: edge-detection custom camera, fine-tuning per supplier,
      desktop-agent fallback for Zeron

---

## License

Private — internal use only.
