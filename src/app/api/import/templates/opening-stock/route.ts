import { requireApiUser } from "@/lib/api/guard";
import {
  csvAttachmentResponse,
} from "@/lib/import/http";
import { openingStockTemplateCsv } from "@/lib/import/opening-stock";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  return csvAttachmentResponse(
    openingStockTemplateCsv(),
    "opening-stock-template.csv",
  );
}
