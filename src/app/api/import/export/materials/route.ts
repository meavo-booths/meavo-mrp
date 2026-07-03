import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/guard";
import { csvAttachmentResponse } from "@/lib/import/http";
import { exportMaterialsCsv } from "@/lib/import/materials";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  return csvAttachmentResponse(await exportMaterialsCsv(), "materials.csv");
}
