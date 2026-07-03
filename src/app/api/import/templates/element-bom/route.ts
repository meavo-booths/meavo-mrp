import { requireApiUser } from "@/lib/api/guard";
import { csvAttachmentResponse } from "@/lib/import/http";
import { elementBomTemplateCsv } from "@/lib/import/element-bom";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  return csvAttachmentResponse(
    elementBomTemplateCsv(),
    "element-bom-template.csv",
  );
}
