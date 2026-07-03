import { requireApiUser } from "@/lib/api/guard";
import { csvAttachmentResponse } from "@/lib/import/http";
import { exportOpeningStockCsv } from "@/lib/import/opening-stock";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  return csvAttachmentResponse(await exportOpeningStockCsv(), "opening-stock.csv");
}
