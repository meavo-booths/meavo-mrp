# Meavo MRP — Accounts Checklist

This is a one-page checklist of every account you need to create before the
app can be built and deployed. Use a **company email** (e.g.
`admin@yourcompany.bg`) and turn on **2FA** on every account. Store every
secret in a password manager (1Password / Bitwarden), never paste secrets
into chat or commit them to git.

> **Estimated total time: ~30 minutes**

---

## 1. GitHub — *free*

- Sign up at [https://github.com](https://github.com)
- Create a private repository named `meavo-mrp`
- Add the repo URL to `.env.local` later (we will push to it from your machine)

**Why:** off-site backup of source code; Vercel deploys from a git repo.

**Free-tier limits that matter:** unlimited private repos at this scale.

**Alternatives if you prefer EU hosting:** [Codeberg](https://codeberg.org)
(non-profit, EU/Germany) or [GitLab.com](https://gitlab.com). Both work with
Vercel; integration is slightly more manual.

---

## 2. Vercel — *Pro trial → Pro after trial*

- Sign up at [https://vercel.com](https://vercel.com) with GitHub login
- **Start the Pro trial** (do not stay on Hobby — its terms forbid commercial
use)
- During first project creation, pick **Frankfurt (`fra1`)** as the primary
region
- In the project → **Storage → Blob**, create a Blob store and connect it —
this provisions the `BLOB_READ_WRITE_TOKEN` used for original document files
- Calendar a reminder ~~3 days before the trial ends: upgrade to Pro
(~~20 EUR/month) or pause go-live until you do

**Why:** runs the webapp; deploys from GitHub on every push; free SSL;
EU-region hosting; Vercel Blob stores the uploaded invoice files.

**Free-tier (Hobby) limitations to be aware of:**


| Limit                  | Hobby         | Why we care                             |
| ---------------------- | ------------- | --------------------------------------- |
| Commercial use         | **forbidden** | The whole reason to start the Pro trial |
| Function max duration  | 60s           | AI extraction calls can take 15–40s     |
| Runtime logs retention | 1 hour        | Hard to debug                           |
| Concurrent builds      | 1             | Two simultaneous deploys queue          |
| Over-quota behaviour   | wait 30 days  | Pro can pay-as-you-go                   |


**Pro plan ($20/month):**

- Includes a **$20 monthly usage credit** for billable resources beyond the
generous included allowances (1 TB bandwidth, 10M edge requests, etc.). The
credit resets each month and is the same $20 you already pay — it is not an
extra $20 on top. Blob storage and egress count toward this usage.

---

## 3. Shared MEAVO Neon Postgres — *no new signup*

MRP does not get its own database — it uses the shared MEAVO Neon Postgres
already used by `meavo-gateway`. There is nothing to sign up for; you need:

- The pooled `DATABASE_URL` — copy the same value from
  Vercel → meavo-gateway → Settings → Environment Variables
- Access to the [`meavo-db`](https://github.com/meavo-booths/meavo-db) repo,
  which owns the Prisma schema (all schema changes happen there; `db:push`
  from this repo is disabled)
- A gateway admin who can invite users and grant the MRP tool card
  (`MRP_TOOL_CARD_ID`, default `seed-mrp-tool` — seeded in meavo-gateway):
  a user can only sign in if they exist in the gateway `User` table **and**
  have a `ToolCardAccess` row for that tool card

**Why:** one shared Postgres for all MEAVO tools; users and access live in
the gateway, so there is no separate login system to manage.

**Limits that matter:** the Neon project is shared — watch storage and
compute usage in the Neon console alongside the other MEAVO apps. See
[`neon-setup.md`](./neon-setup.md) for details.

---

## 4. Google AI Studio (Gemini API) — *free tier first*

- Sign up at [https://aistudio.google.com](https://aistudio.google.com)
- Click **Get API key** → create a new key
- Save the key (`GEMINI_API_KEY`) in your password manager
- Optional: enable billing to leave the free tier (set a budget alert)
- Set the model in `.env.local`: `GEMINI_MODEL=gemini-2.5-flash`

**Why:** the AI vision model that reads invoices and extracts structured
fields.

**Free-tier limits to expect:** rate-limited requests per day; sufficient for
the pilot. **Note:** Google may use free-tier API data to improve products —
acceptable for testing, **not** for sensitive production invoices. Move to a
paid tier (or to Vertex AI in an EU region) before processing real supplier
invoices at scale.

---

## 5. Google Cloud Console — *free, for Google SSO only*

- Sign up / sign in at [https://console.cloud.google.com](https://console.cloud.google.com)
- Create a new project (e.g. `meavo-mrp-auth`)
- **APIs & Services → OAuth consent screen** → Internal (if Workspace) or
External; fill app name, support email, logo (optional)
- **APIs & Services → Credentials → Create credentials → OAuth client ID**
- Application type: **Web application**
- Authorized redirect URIs: the app's own NextAuth callbacks —
`https://mrp.meavo.app/api/auth/callback/google` and
`http://localhost:3000/api/auth/callback/google`
- Save `client_id` and `client_secret` and set them as `AUTH_GOOGLE_ID` /
`AUTH_GOOGLE_SECRET` in `.env.local` and Vercel

**Why:** lets the team sign in with their Google work accounts (NextAuth).

**Cost:** $0. We only use the OAuth feature, no paid Google Cloud services.

---

## 6. Microsoft Entra (Azure portal) — *optional, only if Microsoft 365 SSO*

Skip this entirely if your team uses Google Workspace.

- Sign in at [https://entra.microsoft.com](https://entra.microsoft.com)
- App registrations → New registration → Web → add the app's NextAuth
callback (`https://mrp.meavo.app/api/auth/callback/microsoft-entra-id`) as
a redirect URI
- Generate a client secret; save the secret value (only shown once)
- Add the Microsoft Entra ID provider to NextAuth in `src/lib/auth.ts` and
set its client ID / secret env vars

**Cost:** $0.

---

## 7. Domain (existing — no signup) — *free if you already own it*

- Production lives at `mrp.meavo.app`
- After Vercel project exists, add **one** DNS record at your registrar:

```text
Host:  mrp            Type: CNAME       Value: cname.vercel-dns.com       TTL: auto
```

- Vercel issues and renews the SSL certificate automatically.

---

## 8. (Optional, later) Sentry — *free tier*

- Sign up at [https://sentry.io](https://sentry.io)
- Free tier covers small apps; add later for error monitoring once the app
is in real use

---

## Where each secret goes


| Secret                  | Local dev (`.env.local`) | Production (Vercel env vars) |
| ----------------------- | ------------------------ | ---------------------------- |
| `DATABASE_URL`          | yes                      | yes                          |
| `AUTH_SECRET`           | yes                      | yes                          |
| `AUTH_URL`              | `http://localhost:3000`  | `https://mrp.meavo.app`      |
| `AUTH_GOOGLE_ID`        | yes                      | yes                          |
| `AUTH_GOOGLE_SECRET`    | yes                      | yes                          |
| `MRP_TOOL_CARD_ID`      | `seed-mrp-tool`          | `seed-mrp-tool`              |
| `GATEWAY_URL`           | `https://meavo.app`      | `https://meavo.app`          |
| `BLOB_READ_WRITE_TOKEN` | yes                      | yes                          |
| `GEMINI_API_KEY`        | yes                      | yes                          |
| `GEMINI_MODEL`          | yes                      | yes                          |
| `NEXT_PUBLIC_APP_URL`   | `http://localhost:3000`  | `https://mrp.meavo.app`      |


Never commit `.env.local`. Always use the **Environment Variables** UI in
Vercel for production secrets.

---

## Cost summary


| Phase              | Vercel         | Neon (shared)   | Gemini | Total          |
| ------------------ | -------------- | --------------- | ------ | -------------- |
| Pilot (now)        | $0 (Pro trial) | $0 (shared)     | ~$0–5  | **~$0–5/mo**   |
| After Vercel trial | ~$20           | $0 (shared)     | ~$5–10 | **~$25–30/mo** |
| Production         | ~$20           | shared w/ MEAVO | ~$5–15 | **~$25–35/mo** |


