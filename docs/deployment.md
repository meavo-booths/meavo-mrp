# Deployment

This document covers two deploys:

- **Local development** on a laptop, against a Supabase EU project.
- **Production** on Vercel, against the same Supabase project (or a
  separate one).

---

## Local development

### Prerequisites

- macOS, Linux, or Windows + WSL2
- Node.js **22 LTS** (`node --version` ≥ 22)
- pnpm 9+ (`npm i -g pnpm`)
- A Supabase project (Free tier, EU region) with:
  - Auth providers → Google enabled (see [`oauth-setup.md`](./oauth-setup.md))
  - Storage buckets `originals` and `thumbnails` created (see [`supabase-setup.md`](./supabase-setup.md))
  - The SQL setup blocks from `supabase-setup.md` applied
- A `GEMINI_API_KEY` from <https://aistudio.google.com>

### Steps

```bash
git clone <your-repo-url> meavo-mrp
cd meavo-mrp
pnpm install
cp .env.example .env.local
# fill in real values from Supabase / Google AI Studio

pnpm db:push       # creates all tables in your Supabase database
pnpm dev           # http://localhost:3000
```

Sign in at `http://localhost:3000/bg/login` with your company Google
account, then upload a test invoice from the camera or `/scan` page.

### Resetting the database

```bash
# from the Supabase SQL editor:
drop schema public cascade;
create schema public;

# locally
pnpm db:push
# then re-run the SQL blocks in docs/supabase-setup.md
```

---

## Production (Vercel + Supabase Pro)

### One-time setup

1. Push the repo to GitHub (private).
2. In Vercel → Add New → **Project** → import the GitHub repo.
3. Pick **Frankfurt (`fra1`)** as the production region.
4. Set the following **Environment Variables**:
   - `NEXT_PUBLIC_APP_URL` = `https://stock.yourcompany.bg`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (server only)
   - `DATABASE_URL` (Supabase pooled connection — port `6543`)
   - `DIRECT_DATABASE_URL` (Supabase direct connection — port `5432`)
   - `SUPABASE_BUCKET_ORIGINALS=originals`
   - `SUPABASE_BUCKET_THUMBNAILS=thumbnails`
   - `GEMINI_API_KEY`
   - `GEMINI_MODEL=gemini-2.5-flash`
   - `GEMINI_THINKING_BUDGET=0`
   - `ZERON_ADAPTER=stub` (or `export` once Zeron's import format is set)
5. Deploy. The first build creates the `*.vercel.app` URL — try it.
6. Add a custom domain (see [`domain-setup.md`](./domain-setup.md)).

### Per-deploy

Pushing to `main` triggers a production deploy. Pull-request branches
get preview deploys at `*.vercel.app`.

Database migrations are applied **before** the deploy via:

```bash
pnpm db:migrate
```

— run from a developer machine after merging a schema change. Vercel
deploys do not run migrations automatically (intentional safety).

### Logs and observability

- **Vercel → Logs** for runtime errors.
- **Supabase → Logs** for database / auth issues.
- **Google AI Studio** for Gemini quota and request history.

### Rollback

Vercel keeps every deployment. To roll back:

1. Vercel → Deployments → find the last good one.
2. Three dots → **Promote to production**.

The database is **not** rolled back automatically — make sure schema
changes are backwards compatible (drizzle-kit makes this easy: write
additive migrations).

---

## Pre-launch checklist

- [ ] Supabase Storage buckets exist + RLS policies applied.
- [ ] `auth.users → public.users` trigger created.
- [ ] Vercel domain CNAME resolves with green padlock.
- [ ] Google OAuth client lists the production redirect URI.
- [ ] Vercel env vars filled (no `placeholder` values).
- [ ] At least one admin user has `role='admin'` in `public.users`.
- [ ] One end-to-end test: real photo → AI extract → review → approve →
      Zeron sync attempt visible in `/admin/zeron`.
- [ ] BG operator guide shared with the team
      (`docs/operator-guide-bg.md`).

---

## Cost monitoring

- **Vercel** → Settings → Usage. Set a budget alert at $30.
- **Supabase** → Project → Settings → Usage. Watch storage closely.
- **Google AI Studio** → Billing → Set monthly budget alert at $10.
