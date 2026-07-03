import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { readCsvUpload } from "@/lib/import/http";
import { importElementsCsv } from "@/lib/import/elements";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  try {
    const text = await readCsvUpload(request);
    const result = await importElementsCsv(text);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
