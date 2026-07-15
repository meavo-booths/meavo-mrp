import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAppAdmin, requireApiUser } from "@/lib/api/guard";
import {
  normalizeMaterialCodeList,
  parseMaterialCodeList,
} from "@/lib/settings/parse-code-list";
import {
  getTopMaterialsDetail,
  setTopMaterialCodes,
} from "@/lib/settings/top-materials";

export const runtime = "nodejs";

const PutSchema = z
  .object({
    codes: z.array(z.string()).optional(),
    paste: z.string().optional(),
  })
  .refine((body) => body.codes !== undefined || body.paste !== undefined, {
    message: "Provide codes or paste",
  });

export async function GET() {
  const { error } = await requireApiUser();
  if (error) return error;

  const detail = await getTopMaterialsDetail();
  return NextResponse.json(detail);
}

export async function PUT(request: Request) {
  const { user, error } = await requireAppAdmin();
  if (error) return error;

  const body = PutSchema.parse(await request.json());
  const codes =
    body.paste !== undefined ?
      parseMaterialCodeList(body.paste)
    : normalizeMaterialCodeList(body.codes ?? []);

  try {
    const saved = await setTopMaterialCodes(codes, user.id);
    const detail = await getTopMaterialsDetail();
    return NextResponse.json({ codes: saved, ...detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
