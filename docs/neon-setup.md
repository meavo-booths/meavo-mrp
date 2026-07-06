# Shared Neon database setup

MRP no longer has its own database. It uses the shared MEAVO Neon Postgres,
whose schema is owned by the [`meavo-db`](https://github.com/meavo-booths/meavo-db)
repo (Prisma). This replaces the old Supabase setup entirely.

## Environment

| Variable | Where to get it |
| --- | --- |
| `DATABASE_URL` | Same pooled Neon URL as `meavo-gateway` (Vercel → meavo-gateway → env vars) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_URL` | `https://mrp.meavo.app` in production |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud OAuth client (see `docs/oauth-setup.md`) |
| `MRP_TOOL_CARD_ID` | `seed-mrp-tool` (seeded in meavo-gateway) |
| `BLOB_READ_WRITE_TOKEN` | Vercel → meavo-mrp → Storage → Blob |

## Schema changes

Never run `db:push` from this repo — it is disabled on purpose. Edit
`prisma/schema.prisma` in `meavo-db` (the `---- Manufacturing / MRP ----`
section), apply from there, tag a release, and bump the `@meavo/db` git tag in
this repo's `package.json`.

## Identity and roles

- Users live in the gateway `User` table (cuid ids). There is no MRP `users`
  table anymore.
- Access: a user must exist in `User` **and** have a `ToolCardAccess` row for
  `MRP_TOOL_CARD_ID`. Invite users and grant access from the gateway admin.
- App roles (`scanner` / `reviewer` / `admin`) live in `MrpUserProfile`,
  auto-created with `scanner` on first login. Promote users by updating that
  row (e.g. via Prisma Studio in meavo-db or the gateway DB console).

## Files

Original documents are stored as private Vercel Blobs under
`mrp/originals/{userId}/{documentId}/{filename}` and served only through the
authorized `/api/documents/[id]/file` route.
