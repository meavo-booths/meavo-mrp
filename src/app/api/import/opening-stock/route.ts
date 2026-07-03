import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { readCsvUpload } from "@/lib/import/http";
import { importOpeningStockCsv } from "@/lib/import/opening-stock";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { user, error } = await requireApiUser();
  if (error) return error;

  try {
    const text = await readCsvUpload(request);
    const result = await importOpeningStockCsv(text, user.id);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed" },
      { status: 400 },
    );
  }
}
