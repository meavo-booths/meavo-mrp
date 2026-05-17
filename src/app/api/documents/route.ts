import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

import { db, schema } from "@/lib/db/client";
import { getSessionUser } from "@/lib/auth/session";
import { buildOriginalPath, uploadOriginal } from "@/lib/storage/buckets";
import { sha256Hex } from "@/lib/utils/hash";
import { sanitizeFilename } from "@/lib/utils/sanitize-filename";

export const runtime = "nodejs";

const TypeHintSchema = z
  .enum(["auto", "invoice", "proforma", "delivery_note"])
  .default("auto");

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const MAX_BYTES = 25 * 1024 * 1024;

/** POST /api/documents — multipart/form-data: file=<File>, typeHint=<...>. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  const typeHintParam = (form.get("typeHint") as string | null) ?? "auto";
  const typeHint = TypeHintSchema.parse(typeHintParam);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB).` },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentHash = sha256Hex(bytes);

  // Dedupe: if a document with same hash from same user already exists,
  // return its ID instead of creating a new one.
  const existing = await db.query.documents.findFirst({
    where: (d, { and, eq: e }) =>
      and(e(d.contentHash, contentHash), e(d.createdBy, user.id)),
  });
  if (existing) {
    return NextResponse.json({ id: existing.id, deduped: true });
  }

  const documentId = randomUUID();
  const safeName = sanitizeFilename(file.name || "scan");
  const path = buildOriginalPath({
    userId: user.id,
    documentId,
    filename: safeName,
  });

  await uploadOriginal(path, bytes, file.type);

  // Map "auto" hint to a sensible default before INSERT (NOT NULL column).
  const initialType = typeHint === "auto" ? "invoice" : typeHint;

  await db.insert(schema.documents).values({
    id: documentId,
    type: initialType,
    status: "pending_review",
    originalFilePath: path,
    originalMimeType: file.type,
    originalSizeBytes: file.size,
    contentHash,
    createdBy: user.id,
  });

  return NextResponse.json({ id: documentId });
}

/** GET /api/documents — list documents for the current user. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.query.documents.findMany({
    where: eq(schema.documents.createdBy, user.id),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
    limit: 200,
  });

  return NextResponse.json({ documents: rows });
}
