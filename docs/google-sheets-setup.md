# Google Sheets sync setup (tomorrow)

## 1. Google Cloud

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. **APIs & Services → Enable APIs** → enable **Google Sheets API**.
4. **IAM → Service Accounts → Create** (e.g. `meavo-mrp-sync`).
5. Create a **JSON key** and download it.

## 2. Share spreadsheets

Share with the service account email (`…@….iam.gserviceaccount.com`) as **Viewer**:

- Master plan: `1aly6kRe_01ZDH_MnzaTtH6uVrqdsUX_p8AUAvt8EdO4`
- Parent Drive folder containing all batch spreadsheets (easiest), **or** each batch file linked from column A

## 3. Environment variables

In `.env.local` / Vercel:

```bash
GOOGLE_SHEETS_MASTER_ID=1aly6kRe_01ZDH_MnzaTtH6uVrqdsUX_p8AUAvt8EdO4
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}  # entire JSON on one line
CRON_SECRET=your-random-secret
```

## 4. After env is set

Trigger sync manually:

```bash
curl -X POST https://mrp.meavo.app/api/sheets/sync \
  -H "Authorization: Bearer $CRON_SECRET"
```

Or sign in as an **admin** user and `POST /api/sheets/sync` from the browser devtools.

Vercel cron runs every 2 hours (`vercel.json` → `/api/sheets/sync`).

See manufacturing mapping: tab `Статус на партиди`, batch files tab `Опаковане`.
