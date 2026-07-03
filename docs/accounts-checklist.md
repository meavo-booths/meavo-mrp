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
- Calendar a reminder ~~3 days before the trial ends: upgrade to Pro
(~~20 EUR/month) or pause go-live until you do

**Why:** runs the webapp; deploys from GitHub on every push; free SSL;
EU-region hosting.

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
extra $20 on top.

---

## 3. Supabase — *Free tier first*

- Sign up at [https://supabase.com](https://supabase.com)
- Create a new project; **region: `eu-central-1` (Frankfurt)**
- Save these into your password manager:
  - Project URL (e.g. `https://xxxxx.supabase.co`)
  - `anon` public key (safe for client)
  - `service_role` key (server only — **never** expose to client)
  - DB connection string (Settings → Database → Connection string → URI)
- In **Authentication → Providers**, enable **Google** (we will paste OAuth
credentials from step 5 here)
- In **Storage**, create two buckets: `originals` (private) and `thumbnails`
(private)

**Why:** managed Postgres + S3-compatible file storage + login system.

**Free-tier limits that matter:**


| Limit        | Free                      | Action when hit                               |
| ------------ | ------------------------- | --------------------------------------------- |
| File storage | **1 GB**                  | Watch in dashboard; upgrade to Pro at ~800 MB |
| DB size      | 500 MB                    | Plenty for metadata; images are not in DB     |
| Egress       | 5 GB/month                | Watch dashboard                               |
| Auto-pause   | **after 7 days inactive** | Open the project to unpause, or upgrade       |
| Backups      | none                      | Acceptable for pilot; not for production      |
| Max upload   | 50 MB                     | Fine for invoice photos / single-page PDFs    |


**Upgrade triggers (move to Pro at ~25 EUR/mo):**

- Storage approaching 800 MB
- App was auto-paused at least once and that became disruptive
- You need automated daily backups
- Egress / fair-use warnings appear

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
- Authorized redirect URIs: paste the value Supabase shows in
Authentication → Providers → Google
- Save `client_id` and `client_secret` and paste them into Supabase Auth
Google provider

**Why:** lets the team sign in with their Google work accounts.

**Cost:** $0. We only use the OAuth feature, no paid Google Cloud services.

---

## 6. Microsoft Entra (Azure portal) — *optional, only if Microsoft 365 SSO*

Skip this entirely if your team uses Google Workspace.

- Sign in at [https://entra.microsoft.com](https://entra.microsoft.com)
- App registrations → New registration → Web → add Supabase redirect URI
- Generate a client secret; save the secret value (only shown once)
- Paste `Application (client) ID`, `Directory (tenant) ID` and the secret
into Supabase Auth Microsoft provider

**Cost:** $0.

---

## 7. Domain (existing — no signup) — *free if you already own it*

- We use a subdomain like `stock.yourcompany.bg`
- After Vercel project exists, add **one** DNS record at your registrar:

```text
Host:  stock          Type: CNAME       Value: cname.vercel-dns.com       TTL: auto
```

- Vercel issues and renews the SSL certificate automatically.

---

## 8. (Optional, later) Sentry — *free tier*

- Sign up at [https://sentry.io](https://sentry.io)
- Free tier covers small apps; add later for error monitoring once the app
is in real use

---

## Where each secret goes


| Secret                          | Local dev (`.env.local`) | Production (Vercel env vars)   |
| ------------------------------- | ------------------------ | ------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | yes                      | yes                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes                      | yes                            |
| `SUPABASE_SERVICE_ROLE_KEY`     | yes                      | yes (server only)              |
| `DATABASE_URL`                  | yes                      | yes                            |
| `GEMINI_API_KEY`                | yes                      | yes                            |
| `GEMINI_MODEL`                  | yes                      | yes                            |
| `NEXT_PUBLIC_APP_URL`           | `http://localhost:3000`  | `https://stock.yourcompany.bg` |


Never commit `.env.local`. Always use the **Environment Variables** UI in
Vercel for production secrets.

---

## Cost summary


| Phase              | Vercel         | Supabase  | Gemini | Total          |
| ------------------ | -------------- | --------- | ------ | -------------- |
| Pilot (now)        | $0 (Pro trial) | $0 (Free) | ~$0–5  | **~$0–5/mo**   |
| After Vercel trial | ~$20           | $0 (Free) | ~$5–10 | **~$25–30/mo** |
| Production         | ~$20           | ~$25      | ~$5–15 | **~$50–60/mo** |


