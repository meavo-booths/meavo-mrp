/** RFC4180 CSV parse/serialize with UTF-8 BOM and multiline quoted fields. */

function detectDelimiter(headerLine: string): "," | ";" {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function firstRecordLine(text: string): string {
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "\n" && !inQuotes) {
      return text.slice(0, i);
    }
  }
  return text;
}

function parseRecords(text: string, delimiter: "," | ";"): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(cur);
    cur = "";
  };

  const pushRow = () => {
    if (row.some((cell) => cell.length > 0)) {
      records.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else if (ch === "\r") {
      // normalized away; ignore lone CR
    } else {
      cur += ch;
    }
  }

  pushField();
  pushRow();

  return records;
}

export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const raw = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  if (!raw.trim()) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(firstRecordLine(raw));
  const records = parseRecords(raw, delimiter);
  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0]!.map((h) => h.trim());
  const rows = records
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim().length > 0));

  return { headers, rows };
}

function escapeCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function serializeCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(escapeCell).join(","),
    ...rows.map((row) =>
      headers.map((_, i) => escapeCell(row[i] ?? "")).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function rowsToObjects(
  headers: string[],
  rows: string[][],
): Record<string, string>[] {
  return rows.map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = cells[i] ?? "";
    });
    return obj;
  });
}
