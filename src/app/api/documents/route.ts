import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import { invoiceScannerDisabledResponse, requireApiUser } from "@/lib/api/guard";
import { prisma } from "@/lib/prisma";
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

/** BigInt columns cannot be JSON.stringify-ed — convert before returning. */
function serializeDocument<T extends { originalSizeBytes: bigint | null }>(
  doc: T,
) {
  return {
    ...doc,
    originalSizeBytes:
      doc.originalSizeBytes === null ? null : Number(doc.originalSizeBytes),
  };
}

/** POST /api/documents — multipart/form-data: file=<File>, typeHint=<...>. */
export async function POST(request: Request) {
  const disabled = invoiceScannerDisabledResponse();
  if (disabled) return disabled;
  const { user, error } = await requireApiUser();
  if (error) return error;

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
  const existing = await prisma.mrpDocument.findFirst({
    where: { contentHash, createdById: user.id },
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

  try {
    await uploadOriginal(path, bytes, file.type);
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[documents:POST] storage upload failed:", e);
    return NextResponse.json(
      { error: "Storage upload failed: " + msg },
      { status: 500 },
    );
  }

  // Map "auto" hint to a sensible default before INSERT (NOT NULL column).
  const initialType = typeHint === "auto" ? "invoice" : typeHint;

  try {
    await prisma.mrpDocument.create({
      data: {
        id: documentId,
        type: initialType,
        status: "pending_review",
        storageKey: path,
        originalMimeType: file.type,
        originalSizeBytes: BigInt(file.size),
        contentHash,
        createdById: user.id,
      },
    });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[documents:POST] DB insert failed:", e);
    return NextResponse.json(
      { error: "Failed to save document row: " + msg },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: documentId });
}

/** GET /api/documents — list documents for the current user. */
export async function GET() {
  const disabled = invoiceScannerDisabledResponse();
  if (disabled) return disabled;
  const { user, error } = await requireApiUser();
  if (error) return error;

  const rows = await prisma.mrpDocument.findMany({
    where: { createdById: user.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json({ documents: rows.map(serializeDocument) });
}
