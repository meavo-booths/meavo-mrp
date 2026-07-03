import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { ensureStockReferenceData, listBalances } from "@/lib/stock";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  await ensureStockReferenceData();

  const warehouseId =
    new URL(request.url).searchParams.get("warehouseId") ?? undefined;

  const balances = await listBalances({
    warehouseId: warehouseId ?? undefined,
  });

  return NextResponse.json({ balances });
}
