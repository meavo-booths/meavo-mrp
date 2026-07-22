import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/guard";
import { env } from "@/lib/env";
import {
  listReadyUndeductedLines,
  postRpDeductions,
} from "@/lib/stock/rp-deductions";

export const runtime = "nodejs";

const BodySchema = z
  .object({
    rpLineItemIds: z.array(z.string().min(1)).min(1).optional(),
    rpRequestId: z.string().min(1).optional(),
  })
  .refine((b) => Boolean(b.rpLineItemIds?.length || b.rpRequestId), {
    message: "Provide rpLineItemIds or rpRequestId",
  });

function isAuthorizedSharedSecret(request: Request): boolean {
  const secret = env.RP_MRP_DEDUCT_SECRET ?? process.env.RP_MRP_DEDUCT_SECRET;
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const shared = isAuthorizedSharedSecret(request);
  if (!shared) {
    const { error } = await requireApiUser();
    if (error) return error;
  }

  const lines = await listReadyUndeductedLines();
  return NextResponse.json({
    lines: lines.map((l) => ({
      id: l.id,
      kind: l.kind,
      panelName: l.panelName,
      partRpCode: l.partRpCode,
      quantity: l.quantity,
      fulfillment: l.fulfillment,
      materialsDeductionError: l.materialsDeductionError,
      rp: l.rpRequest,
    })),
  });
}

export async function POST(request: Request) {
  const shared = isAuthorizedSharedSecret(request);
  let createdById: string | null = null;
  if (!shared) {
    const { user, error } = await requireApiUser();
    if (error) return error;
    createdById = user.id;
  }

  const body = BodySchema.parse(await request.json());
  const result = await postRpDeductions({
    rpLineItemIds: body.rpLineItemIds,
    rpRequestId: body.rpRequestId,
    createdById,
  });

  return NextResponse.json(result);
}
