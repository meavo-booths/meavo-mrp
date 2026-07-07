import "server-only";

import { GoogleAuth } from "google-auth-library";

export type SheetsGridCell = {
  formattedValue?: string;
  hyperlink?: string;
};

async function getAccessToken(readonly = true): Promise<string> {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  }

  const credentials = JSON.parse(raw) as Record<string, unknown>;
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      readonly
        ? "https://www.googleapis.com/auth/spreadsheets.readonly"
        : "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
  const client = await auth.getClient();
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
