# Deployment

This document covers two deploys:

- **Local development** on a laptop, against the shared MEAVO Neon database.
- **Production** on Vercel, against the same shared Neon database.

---

## Local development

### Prerequisites

- macOS, Linux, or Windows + WSL2
- Node.js **22 LTS** (`node --version` ≥ 22)
- pnpm 9+ (`npm i -g pnpm`)
- The shared MEAVO Neon `DATABASE_URL` — same value as `meavo-gateway`
  (see [`neon-setup.md`](./neon-setup.md))
- A Google Cloud OAuth client for NextAuth (see [`oauth-setup.md`](./oauth-setup.md))
- A gateway user with a `ToolCardAccess` row for `MRP_TOOL_CARD_ID`
  (invite the user and grant the MRP tool card from the gateway admin)
- A `BLOB_READ_WRITE_TOKEN` from Vercel → meavo-mrp → Storage → Blob
- A `GEMINI_API_KEY` from <https://aistudio.google.com>

### Steps

```bash
git clone <your-repo-url> meavo-mrp
cd meavo-mrp
pnpm install       # also runs `prisma generate` from the shared @meavo/db schema
cp .env.example .env.local
# fill in real values (Neon DATABASE_URL, AUTH_*, Blob token, Gemini)

pnpm dev           # http://localhost:3000
```

Sign in at `http://localhost:3000/bg/login` with your company Google
account, then upload a test invoice from the camera or `/scan` page.

### Schema changes

There is no `db:push` from this repo — it is disabled on purpose. The
schema is owned by the [`meavo-db`](https://github.com/meavo-booths/meavo-db)
repo:

```bash
# in meavo-db: edit prisma/schema.prisma (the ---- Manufacturing / MRP ---- section),
# apply from there, tag a release

# in this repo: bump the @meavo/db git tag in package.json, then
pnpm install       # regenerates the Prisma client
```

---

## Production (Vercel + shared Neon)

### One-time setup

1. Push the repo to GitHub (private).
2. In Vercel → Add New → **Project** → import the GitHub repo.
3. Pick **Frankfurt (`fra1`)** as the production region.
4. In Vercel → Storage → **Blob**, create a Blob store and connect it to
   the project (this provisions `BLOB_READ_WRITE_TOKEN`).
5. Set the following **Environment Variables**:
   - `NEXT_PUBLIC_APP_URL` = `https://mrp.meavo.app`
   - `DATABASE_URL` (shared pooled Neon URL — same value as `meavo-gateway`)
   - `AUTH_SECRET` (`openssl rand -base64 32`)
   - `AUTH_URL` = `https://mrp.meavo.app`
   - `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` (Google OAuth client)
   - `MRP_TOOL_CARD_ID` = `seed-mrp-tool` (seeded in meavo-gateway)
   - `GATEWAY_URL` = `https://meavo.app`
   - `BLOB_READ_WRITE_TOKEN` (from step 4, if not auto-connected)
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `GEMINI_THINKING_BUDGET=0`
   - `ZERON_ADAPTER=stub` (or `export` once Zeron's import format is set)
6. Deploy. The first build creates the `*.vercel.app` URL — try it.
7. Add a custom domain (see [`domain-setup.md`](./domain-setup.md)).

### Per-deploy

Pushing to `main` triggers a production deploy. Pull-request branches
get preview deploys at `*.vercel.app`.

Database migrations are applied **from the `meavo-db` repo** after
merging a schema change there — then the `@meavo/db` tag is bumped here
and deployed. Vercel deploys of this repo never run migrations
(intentional safety).

### Logs and observability

- **Vercel → Logs** for runtime errors.
- **Neon console** for database issues (shared MEAVO project).
- **Google AI Studio** for Gemini quota and request history.

### Rollback

Vercel keeps every deployment. To roll back:

1. Vercel → Deployments → find the last good one.
2. Three dots → **Promote to production**.

The database is **not** rolled back automatically — make sure schema
changes in `meavo-db` are backwards compatible (write additive Prisma
migrations, since other MEAVO apps share the same database).

---

## Pre-launch checklist

- [ ] Vercel Blob store created + `BLOB_READ_WRITE_TOKEN` set.
- [ ] Every teammate invited in the gateway and granted the MRP tool
      card (`ToolCardAccess` row for `MRP_TOOL_CARD_ID`).
- [ ] Vercel domain CNAME resolves with green padlock.
- [ ] Google OAuth client lists
      `https://mrp.meavo.app/api/auth/callback/google` as a redirect URI.
- [ ] Vercel env vars filled (no `placeholder` values).
- [ ] At least one admin user has `role='admin'` in `MrpUserProfile`.
- [ ] One end-to-end test: real photo → AI extract → review → approve →
      Zeron sync attempt visible in `/admin/zeron`.
- [ ] BG operator guide shared with the team
      (`docs/operator-guide-bg.md`).

---

## Cost monitoring

- **Vercel** → Settings → Usage. Set a budget alert at $30. Blob storage
  and egress count toward this usage.
- **Neon console** → shared MEAVO project → Usage. Watch storage and
  compute (shared with the other MEAVO apps).
- **Google AI Studio** → Billing → Set monthly budget alert at $10.
