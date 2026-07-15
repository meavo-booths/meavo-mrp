# Zeron Outreach — getting an integration spec

Zeron is the Bulgarian ERP/CRM where every approved invoice will eventually
land. Their public website mentions "web services" and "MS Excel imports" but
publishes no developer documentation — the only path to a real API
integration (Plan A) is to email them directly.

Until a developer spec arrives, the app falls back to:

- **Plan B**: `ZeronManualExportAdapter` — generates an XLSX file in the
  shape of a Zeron purchase-invoice import and lets the admin download it.
- **Plan C** (last resort, Phase 4): a desktop helper that automates the
  Zeron web UI on the user's machine.

This document holds:

1. Two ready-to-send outreach emails (Bulgarian + English), and
2. The integration questionnaire we want their reply to cover.

Save Zeron's eventual reply at the bottom of this file so the API spec
lives next to the code that consumes it.

---

## Email — Bulgarian

> **To:** support@zeron.bg, sales@zeron.bg
> **Cc:** admin@meavostock.bg (your company's tech contact)
> **Subject:** Заявка за документация на Zeron API / Web Services — Meavo

```
Здравейте,

Казвам се <ИМЕ>, от <КОМПАНИЯ>. Използваме Zeron като ERP/CRM система за
доставчици, фактури и складова отчетност, и в момента разработваме
вътрешно мобилно/уеб приложение („Meavo MRP”), което автоматично:

  1) сканира фактури, проформи и стокови разписки от телефона на склада,
  2) извлича структурираните данни с помощта на AI (Gemini),
  3) дава на оператора възможност да прегледа, поправи и одобри данните,
  4) накрая прехвърля одобрения документ в Zeron.

Бихме искали да направим точка 4) с автоматизация през ваше API/Web
Service, вместо ръчен импорт. Затова, моля, пратете ни:

  • Налична ли е документация за вашите Web Services / API за нашата
    инсталация на Zeron?
  • Метод за оторизация (API ключ, OAuth, потребителска сесия)?
  • Endpoints за:
      – създаване на покупни фактури / проформи / стокови разписки
      – асоцииране на доставчик (по ЕИК и/или ДДС №)
      – асоцииране на артикул (търсене по код/име)
      – прикачване на оригинал на документа (изображение/PDF)
  • Примерни payload-и (JSON / SOAP) за тези заявки
  • Налична ли е sandbox / test среда?
  • Има ли ограничения по rate-limit или брой заявки на ден/час?
  • Какви са изискванията за първоначална настройка от ваша страна
    (отделен потребител, специфични настройки, IP whitelist и т.н.)?

Като резерва използваме XLSX/XML импорт. Ако има конкретен шаблон за
импорт на покупни фактури, който препоръчвате, моля изпратете ни го.

Благодаря предварително — ако е по-удобно, можем да организираме кратък
онлайн разговор.

Поздрави,
<ИМЕ>
<ДЛЪЖНОСТ>
<КОМПАНИЯ>
тел: <ТЕЛЕФОН>
admin@meavostock.bg
```

---

## Email — English

> **To:** support@zeron.bg, sales@zeron.bg
> **Cc:** admin@meavostock.bg
> **Subject:** Request for Zeron API / Web Services documentation — Meavo

```
Hello,

My name is <NAME>, working at <COMPANY> in Sofia. We use Zeron as the ERP
for suppliers, invoices, and warehouse stock. We are currently building an
internal mobile/web application ("Meavo MRP") that:

  1) photographs supplier invoices, proforma invoices and delivery notes
     from a warehouse worker's phone,
  2) uses AI (Google Gemini) to extract the structured fields,
  3) lets a reviewer correct and approve the extraction, and
  4) pushes the approved record into Zeron.

We would like step (4) to be automated via your API / Web Service rather
than manual data entry. Could you please share:

  • Is there developer documentation for the Web Services / API on our
    Zeron installation?
  • What authentication method is used (API key, OAuth, user session)?
  • What endpoints are available for:
      – creating purchase invoices / proforma invoices / delivery notes,
      – matching a supplier by EIK and/or VAT number,
      – matching an item by code or name,
      – attaching the original document image / PDF?
  • Sample request/response payloads (JSON or SOAP).
  • Is a sandbox / test environment available?
  • Are there rate limits per minute / hour / day?
  • What customer-side configuration is required (dedicated API user,
    feature flag, IP allow-list, etc.)?

As a fallback we currently produce an XLSX/XML export. If you have a
recommended import template for purchase invoices, please share it so we
can match the column layout.

Thank you in advance — happy to set up a short online call if that's
faster.

Kind regards,
<NAME>
<TITLE>
<COMPANY>
phone: <PHONE>
admin@meavostock.bg
```

---

## Integration questionnaire (what their reply must cover)

We will only flip `ZERON_ADAPTER=api` once we have answers to **all** of:

| # | Question | Why it matters |
| --- | --- | --- |
| 1 | API base URL (production + test) | Required to call any endpoint |
| 2 | Authentication method | Determines how we store secrets |
| 3 | If API key: how/where does the customer create one? | Customer self-service vs. requires support ticket |
| 4 | If OAuth: client ID / client secret issuance procedure | Required for setup |
| 5 | Endpoint to create a **purchase invoice** | Core integration |
| 6 | Endpoint to create a **proforma invoice** | Some incoming docs are proformas |
| 7 | Endpoint to create a **delivery note (стокова разписка)** | Distinct from an invoice in BG VAT law |
| 8 | Field-by-field schema for each of those endpoints | Maps directly to our Drizzle types |
| 9 | Required vs optional fields | Validation upfront |
| 10 | Endpoint to look up a **supplier** by EIK / VAT number | Avoids duplicate suppliers |
| 11 | Endpoint to **create** a supplier if missing | Self-healing imports |
| 12 | Endpoint to look up an **item / SKU** | Match line items |
| 13 | How to attach the **original document image** | Audit + GDPR compliance |
| 14 | How to flag **reverse-charge / non-EU import** | Bulgarian VAT treatment |
| 15 | Idempotency: can we send the same request twice safely? | Retry-on-failure strategy |
| 16 | Rate limits | Sizing the queue / backoff |
| 17 | Error format (codes, messages, localization) | Surfacing failures in admin UI |
| 18 | Sandbox URL and test credentials | We never test against production |
| 19 | Webhook notifications back to us? | Two-way sync (later) |
| 20 | Versioning policy | When to expect breaking changes |

When the answers arrive, fill them into the table at the bottom of this
file and ping the engineering channel — we will then implement the real
`apiAdapter` based on the spec.

---

## Manual export fallback (Plan B)

If Zeron will not provide an API in a reasonable time, the export adapter
generates an XLSX with two sheets:

- **Header**: one row per document with all document/supplier metadata
- **Lines**: one row per line item, joined back to the header by the
  document number

This shape mirrors the most common ERP-import templates in Bulgaria. If
Zeron has a specific column ordering, update
`src/lib/zeron/exportAdapter.ts` to match.

---

## Reply log

```
Date received: 2026-07-13
Replied by:    Zeron dev team
Summary:       Added nomenclature marker „Получаване - проследяване”; requested our
               inbound endpoint URL + auth (user/password or token). Outbound API for
               creating purchase documents not yet documented.
Attachments:   —
```

### Inbound webhook (ready to share with Zeron)

Production endpoint (after deploy + env vars set on Vercel):

```
POST https://mrp.meavo.app/api/zeron/inbound
```

**Authentication** — configure on Vercel, then share one of:

| Method | Header | Value |
| --- | --- | --- |
| Token (preferred) | `Authorization` | `Bearer <ZERON_WEBHOOK_TOKEN>` |
| Basic auth | `Authorization` | `Basic <base64(user:password)>` |

Generate a token locally:

```bash
openssl rand -hex 32
```

Set on Vercel → Environment Variables:

- `ZERON_WEBHOOK_TOKEN` — long random hex string, **or**
- `ZERON_WEBHOOK_USER` + `ZERON_WEBHOOK_PASSWORD`

**Request body:** JSON or XML (stored as-is until schema is confirmed). JSON payloads
with a `materials` / `items` / `nomenclature` array are upserted into Materials;
known unit aliases are normalized (`kg` → `кг`), unknown units are accepted and
flagged on the Materials page for manual review.

**Success response:** `200` with `{ "ok": true, "id": "<uuid>", "receivedAt": "<ISO8601>" }`.

Route: `src/app/api/zeron/inbound/route.ts` · payloads archived under
`mrp/zeron-inbound/` in Vercel Blob when `BLOB_READ_WRITE_TOKEN` is set.
