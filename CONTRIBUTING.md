# Contributing — meavo-mrp

## Before you open a PR

- [ ] Changes are scoped to the request — no drive-by refactors
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes (no test suite — document a manual check in the PR)
- [ ] Agent docs updated if you added routes, domain modules, crons, or auth rules
- [ ] Stock writes go through `applyMovement()`; Zeron pushes through `enqueueZeronSync()`
- [ ] New UI strings added to both `messages/bg.json` and `messages/en.json`
- [ ] New pages checked at 375px and 1280px widths

## Branch naming

`feature/short-description`, `fix/short-description`, `docs/short-description`

## Commit messages

Imperative mood, complete sentences: "Add optional invoice number field to stock receipts."

## Code placement

| Layer | Location |
|-------|----------|
| Pages | `src/app/[locale]/(app)/<feature>/` |
| API route handlers (all mutations) | `src/app/api/` — thin: guard, validate, call lib |
| Business logic | `src/lib/<area>/` (stock, documents, extractor, import, …) |
| Integrations | `src/lib/zeron/`, `src/lib/sheets/`, `src/lib/google/`, `src/lib/storage/` |
| UI kit | `src/components/ui/` (shadcn pattern) |

## Cross-repo dependencies

`@meavo/db` is pinned to a git tag in `package.json`. To pick up schema changes: bump the ref (e.g. `#v0.3.2`), run `pnpm install` (triggers `prisma generate`), redeploy.

## Schema changes

Only in [meavo-db](https://github.com/meavo-booths/meavo-db) — edit schema there, apply from that repo, tag a release, then bump the ref here. Never `prisma db push` from this repo (script is disabled).

## Deployment

Vercel auto-deploys `main`. Env var changes: update `.env.local` and run `scripts/push-env-to-vercel.sh`.

## PR description

Include:

1. **What** changed (user-visible or API behaviour)
2. **Why** (link issue if any)
3. **How to verify** (commands or manual steps)
4. **Out of scope** (what you intentionally did not change)

## Agent-assisted PRs

If an AI agent wrote the code:

- Verify paths and business rules against `docs/domain.md`
- Reject leftover template placeholder comments in merged files
- Ensure no secrets in diff
