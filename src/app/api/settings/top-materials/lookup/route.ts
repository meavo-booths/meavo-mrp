import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { normalizeMaterialCodeList } from "@/lib/settings/parse-code-list";
import { resolveTopMaterialEntries } from "@/lib/settings/top-materials";

export const runtime = "nodejs";

const LookupSchema = z.object({
  codes: z.array(z.string()),
});

/** Resolve material codes to master-data names (for settings preview). */
export async function POST(request: Request) {
  const { error } = await requireApiUser();
  if (error) return error;

  const body = LookupSchema.parse(await request.json());
  const entries = await resolveTopMaterialEntries(
    normalizeMaterialCodeList(body.codes),
  );

  return NextResponse.json({ entries });
}
