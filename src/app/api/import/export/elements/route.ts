import { requireApiUser } from "@/lib/api/guard";
import { csvAttachmentResponse } from "@/lib/import/http";
import { exportElementsCsv } from "@/lib/import/elements";

export const runtime = "nodejs";

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;
  return csvAttachmentResponse(await exportElementsCsv(), "elements.csv");
}
