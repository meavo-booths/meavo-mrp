import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
import { ensureStockReferenceData } from "@/lib/stock";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  await ensureStockReferenceData();

  const rows = await prisma.mrpWarehouse.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ warehouses: rows });
}
