# Custom domain setup (~5 minutes + DNS propagation)

Goal: serve the production app at `stock.yourcompany.bg` (or whatever
subdomain you picked) with HTTPS. Vercel takes care of the SSL
certificate; you only have to add a single DNS record.

---

## 1. Pick the subdomain

Use a sub-domain of your existing company domain. **Do not buy a new
top-level domain just for this** — it costs more and slows down email
deliverability for OAuth notifications.

Suggested: `stock.yourcompany.bg`.

---

## 2. Add the domain in Vercel

1. Vercel → Project → **Settings → Domains → Add**.
2. Type `stock.yourcompany.bg` → Add.
3. Vercel shows a **CNAME record** to add at your DNS provider:

   ```text
   Host:  stock          Type: CNAME       Value: cname.vercel-dns.com       TTL: auto
   ```

---

## 3. Add the DNS record at your registrar

Where you manage DNS for `yourcompany.bg` (often the same place you
bought the domain — Cloudflare, Namecheap, GoDaddy, .BG registrar, etc.):

1. Find the DNS / DNS records area.
2. Click **Add record**.
3. Fill in exactly:

   | Field | Value |
   | --- | --- |
   | Type | `CNAME` |
   | Name / Host | `stock` |
   | Target / Points to | `cname.vercel-dns.com` |
   | TTL | leave default (auto / 1 hour) |
   | Proxy / Cloudflare orange cloud | **disabled / DNS-only** |

4. Save.

> Cloudflare specific: switch the orange cloud to **DNS only (grey)**
> for this record, otherwise Cloudflare's edge will serve a different
> cert and Vercel cannot issue Let's Encrypt.

---

## 4. Wait for DNS + SSL

- DNS usually propagates in 1–10 minutes; sometimes up to an hour.
- Vercel polls and issues a free Let's Encrypt SSL certificate
  automatically once DNS resolves.
- The Domains page in Vercel turns the entry green when ready.

---

## 5. Update environment variables and OAuth

1. Vercel → Project → **Settings → Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_APP_URL` | `https://stock.yourcompany.bg` |
   | `AUTH_URL` | `https://stock.yourcompany.bg` |

2. Re-deploy.
3. In Google Cloud (and Microsoft Entra if used), add
   `https://stock.yourcompany.bg` to **Authorized JavaScript origins**
   and `https://stock.yourcompany.bg/api/auth/callback/google` to
   **Authorized redirect URIs** (NextAuth handles the OAuth callback on
   your own domain).

---

## 6. Test

Visit `https://stock.yourcompany.bg/bg/login` — you should see the
green padlock and be able to sign in via Google.

If the page is blank or shows a Vercel 404:

- Confirm the domain is mapped to the correct Vercel project (not a
  preview or another team's project).
- Confirm DNS propagated: `dig stock.yourcompany.bg CNAME` should show
  `cname.vercel-dns.com.`

If the SSL is invalid:

- Wait 10 minutes for cert issuance.
- Make sure the CNAME is **not proxied** (Cloudflare grey cloud).

---

## Future: serve the staging build separately

Vercel's preview deployments live at `*.vercel.app` automatically — no
DNS work needed. Use them to test before pushing changes to `main`.
For a permanent staging environment, add a second domain such as
`stock-staging.yourcompany.bg` pointing at a `staging` git branch in
the same Vercel project.
