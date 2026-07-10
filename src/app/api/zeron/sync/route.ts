import { NextResponse } from "next/server";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { enqueueZeronSync } from "@/lib/zeron/queue";

export const runtime = "nodejs";
export const maxDuration = 30;

const PostBody = z.object({
  documentId: z.string().uuid(),
});

/** POST /api/zeron/sync — re-attempt a sync for a given document. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = PostBody.safeParse(await request.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await enqueueZeronSync({
    documentId: body.data.documentId,
    requestedBy: user.id,
  });

  return NextResponse.json(result, { status: 202 });
}
