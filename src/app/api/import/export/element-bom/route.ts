import { requireApiUser } from "@/lib/api/guard";
import { csvAttachmentResponse } from "@/lib/import/http";
import { exportElementBomCsv } from "@/lib/import/element-bom";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  return csvAttachmentResponse(await exportElementBomCsv(), "element-bom.csv");
}
