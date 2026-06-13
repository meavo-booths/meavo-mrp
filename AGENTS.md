# AGENTS.md

## Cursor Cloud specific instructions

Meavo Stock is a single **Next.js 16 PWA** (App Router, React 19, TypeScript), package-managed with **pnpm** on **Node 22**. It is not a monorepo. There is no Docker, Makefile, or backend service other than the Next.js app itself. Standard commands live in `package.json` `scripts` and the `README.md` script table — refer there rather than duplicating.

### Running / building / quality gates
- Dev server: `pnpm dev` (port 3000, redirects `/` → `/bg`). Note it runs on **webpack, not turbopack** on purpose (`@serwist/next` lacks turbopack support); don't "fix" it to turbopack.
- Build: `pnpm build`. Lint: `pnpm lint`. Typecheck: `pnpm typecheck`.
- There is **no automated test suite** (no `pnpm test`); quality gates are lint + typecheck only.

### Database (Drizzle + Postgres)
- `pnpm db:migrate` applies the committed migrations in `drizzle/` non-interactively — use this to set up a database.
- Avoid `pnpm db:push` in automation: it is **interactive and hangs without a TTY**. Use `db:migrate` instead.
- `drizzle-kit` does **not** read `.env.local`. Pass the connection string inline, e.g. `DIRECT_DATABASE_URL=... DATABASE_URL=... pnpm db:migrate`.
- Normally the DB is a hosted Supabase Postgres. For local-only DB work, a local Postgres works fine; point `DATABASE_URL`/`DIRECT_DATABASE_URL` at it.

### Auth gating / what needs secrets for end-to-end
- The home page (`/[locale]`) is **public**. `scan`, `documents`, and `admin/zeron` (plus the `/api/documents/*` routes) are **auth-gated**: unauthenticated requests redirect to `/[locale]/login` (Google SSO via Supabase).
- The core scan → extract → review → approve → sync flow therefore requires real credentials that are **not** in the repo: a Supabase project (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`/`DIRECT_DATABASE_URL`, storage buckets `originals`/`thumbnails`, Google OAuth wired into Supabase Auth) and a `GEMINI_API_KEY`. See `.env.example` and `docs/`.
- `src/lib/env.ts` is intentionally permissive (most vars optional) so the app boots/builds with placeholders; routes that need a missing value throw at runtime. So "the app builds and the home page loads" does **not** prove the scanning flow works — that needs the secrets above.
- `ZERON_ADAPTER` defaults to `stub` (no-op); real Zeron sync is roadmap and not required for local dev.
