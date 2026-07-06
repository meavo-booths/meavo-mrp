# Google OAuth setup (~10 minutes)

Goal: let teammates sign in to Meavo MRP with their company Google
account. We achieve this by:

1. Creating a Google Cloud OAuth client (we don't pay anything; this only
   uses Google's free OAuth APIs).
2. Pasting the resulting `client_id` / `client_secret` into the app's
   NextAuth env vars (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`).
3. Verifying that sign-in works on the local dev URL and on the production
   URL.

> **Tip:** keep this tab and your Vercel env vars tab side-by-side; the
> two screens reference each other constantly.

---

## 1. Know the callback URLs

NextAuth handles the OAuth callback itself, on the app's own domain.
The redirect URIs you will register in Google are:

- `http://localhost:3000/api/auth/callback/google` (local dev)
- `https://mrp.meavo.app/api/auth/callback/google` (production)

There is no third-party callback URL — the app is the callback.

---

## 2. Create the Google OAuth client

1. Open <https://console.cloud.google.com> with the company Google account.
2. Top-left project picker → **New project** → name it `meavo-mrp-auth`
   → Create → switch to it.
3. Left nav → **APIs & Services → OAuth consent screen**:
   - **User type**: choose `Internal` if you have Google Workspace; else
     `External`.
   - **App name**: `Meavo MRP`.
   - **User support email**: your admin email.
   - **App logo**: optional (square PNG).
   - **App domain → Application home page**: `https://mrp.meavo.app`
     (or `http://localhost:3000` for local-only).
   - **Authorized domains**: add `meavo.app`.
   - **Developer contact**: same admin email.
   - Save → **Back to dashboard**.
4. Left nav → **APIs & Services → Credentials → Create credentials → OAuth
   client ID**:
   - **Application type**: `Web application`.
   - **Name**: `Meavo MRP — Web`.
   - **Authorized JavaScript origins**: paste
     - `http://localhost:3000`
     - `https://mrp.meavo.app` (your production URL)
   - **Authorized redirect URIs**: paste:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://mrp.meavo.app/api/auth/callback/google`
   - Click **Create**. A modal appears with the **Client ID** and
     **Client Secret** — copy both into your password manager **now**;
     the secret is only shown once.

---

## 3. Set the NextAuth env vars

1. Locally, in `.env.local`:
   - `AUTH_GOOGLE_ID` = the **Client ID** from Google.
   - `AUTH_GOOGLE_SECRET` = the **Client Secret** from Google.
   - `AUTH_SECRET` = output of `openssl rand -base64 32`.
   - `AUTH_URL` = `http://localhost:3000`.
2. In Vercel → Project → **Settings → Environment Variables**, set the
   same four variables, with `AUTH_URL` = `https://mrp.meavo.app`.

Note that signing in with Google is not enough by itself: the user must
also exist in the gateway `User` table **and** have a `ToolCardAccess`
row for `MRP_TOOL_CARD_ID` (invite + grant from the gateway admin — see
[`neon-setup.md`](./neon-setup.md)).

---

## 4. Wire the production redirect

In Vercel → Project → **Settings → Environment Variables**:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://mrp.meavo.app` |
| `AUTH_URL` | `https://mrp.meavo.app` |

Re-deploy (any push to `main`, or "Redeploy latest" in the Deployments
tab). NextAuth uses `AUTH_URL` to build the OAuth callback, so this
needs to be the full HTTPS URL.

---

## 5. Test

### Locally

```bash
pnpm dev
# open http://localhost:3000/bg/login
# click "Continue with Google" → Google consent screen → success → redirected to /bg
```

### Production

Open `https://mrp.meavo.app/bg/login` and run the same flow.

If you see "redirect_uri_mismatch":

- Confirm `https://mrp.meavo.app/api/auth/callback/google` is in the
  **Authorized redirect URIs** in Google Cloud (no trailing slash, https
  not http).
- Confirm Vercel `AUTH_URL` is set to `https://mrp.meavo.app` and the
  project is re-deployed.

If sign-in succeeds at Google but the app denies access:

- The user probably has no `ToolCardAccess` row for `MRP_TOOL_CARD_ID`.
  Invite them in the gateway and grant the MRP tool card.

If you see "Internal" but a teammate cannot sign in:

- The OAuth consent screen is set to `Internal`, which means only members
  of the same Google Workspace org can sign in. Switch to `External` and
  list each teammate as a "Test user", or move the Workspace to include
  all teammates.

---

## Adding Microsoft 365 / Entra later (optional)

Repeat the same shape with Microsoft Entra → App registrations:

1. Register a Web app, add
   `https://mrp.meavo.app/api/auth/callback/microsoft-entra-id` as a
   redirect URI.
2. Generate a client secret; save it.
3. Add the Microsoft Entra ID provider to NextAuth in `src/lib/auth.ts`
   and set its client ID / secret env vars.

`LoginForm` becomes a list of providers, but the same NextAuth route in
`src/app/api/auth/[...nextauth]/route.ts` handles every OAuth provider
transparently.
