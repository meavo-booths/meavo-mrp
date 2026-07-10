import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const LIMIT = 20;

/** Debounced autocomplete source for MaterialCodeField — replaces shipping the full catalog to the client. */
export async function GET(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!q) {
    return NextResponse.json({ materials: [] });
  }

  const materials = await prisma.mrpMaterial.findMany({
    where: {
      isActive: true,
      OR: [
        { code: { contains: q } },
        { name: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, code: true, name: true, unit: true },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    take: LIMIT,
  });

  return NextResponse.json({ materials });
}
