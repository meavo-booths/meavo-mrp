import "server-only";

import { GoogleAuth } from "google-auth-library";

export type SheetsGridCell = {
  formattedValue?: string;
  hyperlink?: string;
};

type AuthClient = Awaited<ReturnType<GoogleAuth["getClient"]>>;

// Auth clients cached per scope set for the process lifetime; the underlying
// google-auth-library client refreshes its token automatically before expiry.
const authClientCache = new Map<string, Promise<AuthClient>>();

function getAuthClient(scopes: string[]): Promise<AuthClient> {
  const key = scopes.join(" ");
  const cached = authClientCache.get(key);
  if (cached) return cached;

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }
  const credentials = JSON.parse(raw) as Record<string, unknown>;
  const auth = new GoogleAuth({ credentials, scopes });
  const promise = auth.getClient().catch((err) => {
    authClientCache.delete(key);
    throw err;
  });
  authClientCache.set(key, promise);
  return promise;
}

async function getAccessToken(
  readonly = true,
  extraScopes: string[] = [],
): Promise<string> {
  const scopes = [
    ...new Set([
      readonly
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
      ...extraScopes,
    ]),
  ].sort();

  const client = await getAuthClient(scopes);
  const token = await client.getAccessToken();
  if (!token.token) {
    throw new Error("Failed to obtain Google Sheets access token");
  }
  return token.token;
}

export async function fetchSheetValues(
  spreadsheetId: string,
  tabName: string,
  rangeSuffix = "A1:ZZ1200",
): Promise<string[][]> {
  const token = await getAccessToken(true);
  const range = encodeURIComponent(`'${tabName}'!${rangeSuffix}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?majorDimension=ROWS`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  return data.values ?? [];
}

/** Read formatted values and hyperlinks for one or more A1 ranges on a spreadsheet. */
export async function fetchSheetGrid(
  spreadsheetId: string,
  ranges: string[],
): Promise<SheetsGridCell[][][]> {
  const token = await getAccessToken(true);
  const params = new URLSearchParams({
    includeGridData: "true",
    fields: "sheets.data.rowData.values(formattedValue,hyperlink)",
  });
  for (const range of ranges) {
    params.append("ranges", range);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${params}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    sheets?: Array<{
      data?: Array<{ rowData?: Array<{ values?: SheetsGridCell[] }> }>;
    }>;
  };

  return (data.sheets ?? []).map(
    (sheet) =>
      sheet.data?.[0]?.rowData?.map((row) => row.values ?? []) ?? [],
  );
}

export function extractSpreadsheetId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ?? null;
}

export function batchNameSearchVariants(batchCode: string): string[] {
  const trimmed = batchCode.trim();
  const upper = trimmed.toUpperCase();
  const variants = new Set<string>([trimmed, upper, upper.replace(/\s+/g, "")]);

  const m = upper.match(/^([A-Z]{2})\s*(\d+)$/);
  if (m) {
    variants.add(`${m[1]}${m[2]}`);
    variants.add(`${m[1]} ${m[2]}`);
  }

  return [...variants];
}

/** Find a batch spreadsheet in Drive when the master sheet cell has no hyperlink. */
export async function findSpreadsheetIdByBatchName(
  batchCode: string,
): Promise<string | null> {
  const token = await getAccessToken(true, [
    "https://www.googleapis.com/auth/drive.readonly",
  ]);

  for (const name of batchNameSearchVariants(batchCode)) {
    const q = encodeURIComponent(
      `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    );
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=3`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) continue;

    const data = (await res.json()) as { files?: Array<{ id: string }> };
    const id = data.files?.[0]?.id;
    if (id) return id;
  }

  return null;
}
