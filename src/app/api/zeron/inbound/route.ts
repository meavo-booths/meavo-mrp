import { NextResponse } from "next/server";

import {
  isAuthorizedZeronWebhook,
  isZeronWebhookAuthConfigured,
} from "@/lib/zeron/webhook-auth";
import { receiveZeronInbound } from "@/lib/zeron/inbound";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/zeron/inbound — Zeron → Meavo webhook for „Получаване - проследяване”.
 *
 * Auth: Bearer token or HTTP Basic (see ZERON_WEBHOOK_* env vars).
 * Body: JSON or XML — stored as-is until the vendor schema is confirmed.
 */
export async function POST(request: Request) {
  if (!isZeronWebhookAuthConfigured() && process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Zeron inbound webhook is not configured" },
      { status: 503 },
    );
  }

  if (!isAuthorizedZeronWebhook(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = await request.text();
  if (!raw.trim()) {
    return NextResponse.json({ error: "Empty body" }, { status: 400 });
  }

  const contentType =
    request.headers.get("content-type")?.split(";")[0]?.trim() ||
    "application/octet-stream";

  try {
    const receipt = await receiveZeronInbound({ body: raw, contentType });
    return NextResponse.json(
      {
        ok: true,
        id: receipt.id,
        receivedAt: receipt.receivedAt,
      },
      { status: 200 },
    );
  } catch (e) {
    console.error("[zeron:inbound] failed to archive payload:", e);
    return NextResponse.json(
      { error: "Failed to process inbound payload" },
      { status: 500 },
    );
  }
}
