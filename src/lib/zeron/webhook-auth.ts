import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function parseBasicAuth(header: string): { user: string; password: string } | null {
  if (!header.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const sep = decoded.indexOf(":");
    if (sep < 0) return null;
    return {
      user: decoded.slice(0, sep),
      password: decoded.slice(sep + 1),
    };
  } catch {
    return null;
  }
}

/** True when at least one inbound webhook auth method is configured. */
export function isZeronWebhookAuthConfigured(): boolean {
  if (env.ZERON_WEBHOOK_TOKEN) return true;
  return Boolean(env.ZERON_WEBHOOK_USER && env.ZERON_WEBHOOK_PASSWORD);
}

/**
 * Authorize a Zeron → Meavo inbound POST.
 *
 * Accepts either:
 * - `Authorization: Bearer <ZERON_WEBHOOK_TOKEN>`
 * - `Authorization: Basic <base64(user:password)>`
 */
export function isAuthorizedZeronWebhook(request: Request): boolean {
  const auth = request.headers.get("authorization");
  if (!auth) {
    if (process.env.NODE_ENV === "development" && !isZeronWebhookAuthConfigured()) {
      return true;
    }
    return false;
  }

  if (env.ZERON_WEBHOOK_TOKEN && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    return safeEqual(token, env.ZERON_WEBHOOK_TOKEN);
  }

  const basic = parseBasicAuth(auth);
  if (
    basic &&
    env.ZERON_WEBHOOK_USER &&
    env.ZERON_WEBHOOK_PASSWORD &&
    safeEqual(basic.user, env.ZERON_WEBHOOK_USER) &&
    safeEqual(basic.password, env.ZERON_WEBHOOK_PASSWORD)
  ) {
    return true;
  }

  return false;
}
