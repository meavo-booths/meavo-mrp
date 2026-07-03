import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/session";
import { isInvoiceScannerEnabled } from "@/lib/features";

export async function requireApiUser() {
  const user = await getSessionUser();
  if (!user) {
    return { user: null as never, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, error: null };
}

export function invoiceScannerDisabledResponse() {
  if (!isInvoiceScannerEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return null;
}
