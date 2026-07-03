import { NextResponse } from "next/server";

export function csvAttachmentResponse(body: string, filename: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function readCsvUpload(request: Request): Promise<string> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new Error("Missing file field");
  }
  return file.text();
}
