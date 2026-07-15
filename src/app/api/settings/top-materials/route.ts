import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import {
  normalizeMaterialCodeList,
  parseMaterialCodeList,
  TOP_MATERIALS_MAX,
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
  const { user, error } = await requireApiUser();
  if (error) return error;

  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = PutSchema.parse(await request.json());
  const codes =
    body.paste !== undefined ?
      parseMaterialCodeList(body.paste)
    : normalizeMaterialCodeList(body.codes ?? []);

  if (codes.length > TOP_MATERIALS_MAX) {
    return NextResponse.json(
      { error: `Maximum ${TOP_MATERIALS_MAX} codes allowed` },
      { status: 400 },
    );
  }

  try {
    const saved = await setTopMaterialCodes(codes, user.id);
    const detail = await getTopMaterialsDetail();
    return NextResponse.json({ codes: saved, ...detail });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
