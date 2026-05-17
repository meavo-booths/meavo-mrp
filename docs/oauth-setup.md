# Google OAuth setup (~10 minutes)

Goal: let teammates sign in to Meavo Stock with their company Google
account. We achieve this by:

1. Creating a Google Cloud OAuth client (we don't pay anything; this only
   uses Google's free OAuth APIs).
2. Pasting the resulting `client_id` / `client_secret` into Supabase Auth's
   Google provider.
3. Verifying that sign-in works on the local dev URL and on the production
   URL.

> **Tip:** keep this tab and your Supabase dashboard tab side-by-side; the
> two screens reference each other constantly.

---

## 1. Get the Supabase callback URL

1. Open Supabase → **Authentication → Sign in / Providers → Google**.
2. Note the value of **Callback URL (for OAuth)** — it looks like
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.

You will paste this URL into Google in the next step. You do **not** need
to enable Google in Supabase yet.

---

## 2. Create the Google OAuth client

1. Open <https://console.cloud.google.com> with the company Google account.
2. Top-left project picker → **New project** → name it `meavo-stock-auth`
   → Create → switch to it.
3. Left nav → **APIs & Services → OAuth consent screen**:
   - **User type**: choose `Internal` if you have Google Workspace; else
     `External`.
   - **App name**: `Meavo Stock`.
   - **User support email**: your admin email.
   - **App logo**: optional (square PNG).
   - **App domain → Application home page**: `https://stock.yourcompany.bg`
     (or `http://localhost:3000` for local-only).
   - **Authorized domains**: add `yourcompany.bg` (and `supabase.co` is
     auto-trusted; you don't need to add it).
   - **Developer contact**: same admin email.
   - Save → **Back to dashboard**.
4. Left nav → **APIs & Services → Credentials → Create credentials → OAuth
   client ID**:
   - **Application type**: `Web application`.
   - **Name**: `Meavo Stock — Web`.
   - **Authorized JavaScript origins**: paste
     - `http://localhost:3000`
     - `https://stock.yourcompany.bg` (your production URL)
   - **Authorized redirect URIs**: paste:
     - `https://YOUR-PROJECT.supabase.co/auth/v1/callback`
       (the Supabase Callback URL from step 1)
   - Click **Create**. A modal appears with the **Client ID** and
     **Client Secret** — copy both into your password manager **now**;
     the secret is only shown once.

---

## 3. Paste credentials into Supabase

1. Back in Supabase → **Authentication → Providers → Google**:
   - Toggle **Enable Sign in with Google** to ON.
   - Paste the **Client ID** from Google.
   - Paste the **Client Secret** from Google.
   - **Save**.
2. Optionally pin **Authorized client IDs** (same client ID) so only this
   OAuth client can be used.

---

## 4. Wire the production redirect

In Vercel → Project → **Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://stock.yourcompany.bg` |

Re-deploy (any push to `main`, or "Redeploy latest" in the Deployments
tab). The login form uses `NEXT_PUBLIC_APP_URL` to build the
`redirectTo` for the OAuth flow, so this needs to be the full HTTPS URL.

---

## 5. Test

### Locally

```bash
pnpm dev
# open http://localhost:3000/bg/login
# click "Continue with Google" → Google consent screen → success → redirected to /bg
```

### Production

Open `https://stock.yourcompany.bg/bg/login` and run the same flow.

If you see "redirect_uri_mismatch":

- Confirm the Supabase callback URL is in the **Authorized redirect URIs**
  in Google Cloud (no trailing slash, https not http).
- Confirm Vercel `NEXT_PUBLIC_APP_URL` is set and the project is
  re-deployed.
- Confirm the project URL in Supabase Auth → Providers → Google → Callback
  matches the URI you pasted in Google Cloud.

If you see "Internal" but a teammate cannot sign in:

- The OAuth consent screen is set to `Internal`, which means only members
  of the same Google Workspace org can sign in. Switch to `External` and
  list each teammate as a "Test user", or move the Workspace to include
  all teammates.

---

## Adding Microsoft 365 / Entra later (optional)

Repeat the same shape with Microsoft Entra → App registrations:

1. Register a Web app, add the Supabase callback URL as a redirect URI.
2. Generate a client secret; save it.
3. Paste `Application (client) ID`, `Directory (tenant) ID`, and the
   secret into Supabase Auth → Providers → Microsoft.

No code changes are needed — `LoginForm` becomes a list of providers, but
the same Supabase callback handler in `src/app/auth/callback/route.ts`
handles every OAuth provider transparently.
