import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getZeronAdapter } from "./factory";

/**
 * Run a sync attempt for a document. Records every attempt in `sync_attempts`
 * (the previous "current" attempt is demoted) and updates the document
 * status to `synced` or `sync_failed`.
 *
 * Designed to be called from `/api/documents/[id]/approve` (fire-and-forget)
 * or from the admin retry button.
 */
export async function enqueueZeronSync(opts: {
  documentId: string;
  requestedBy: string;
}) {
  const { documentId } = opts;
  const adapter = getZeronAdapter();

  // Mark older attempts as not-current.
  await prisma.mrpSyncAttempt.updateMany({
    where: { documentId, isCurrent: true },
    data: { isCurrent: false },
  });

  const attempt = await prisma.mrpSyncAttempt.create({
    data: {
      documentId,
      adapter: adapter.name,
      status: "running",
      isCurrent: true,
    },
  });

  try {
    const document = await prisma.mrpDocument.findUnique({
      where: { id: documentId },
    });
    if (!document) throw new Error("Document not found");

    const supplier = document.supplierId
      ? await prisma.mrpSupplier.findUnique({
          where: { id: document.supplierId },
        })
      : null;

    const lineItems = await prisma.mrpLineItem.findMany({
      where: { documentId },
      orderBy: { position: "asc" },
    });

    const result = await adapter.pushDocument({
      document,
      supplier,
      lineItems,
    });

    await prisma.mrpSyncAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "succeeded",
        response: (result.raw ?? {
          message: result.message,
        }) as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });

    await prisma.mrpDocument.update({
      where: { id: documentId },
      data: {
        status: "synced",
        syncedAt: new Date(),
        zeronId: result.externalId ?? document.zeronId ?? null,
      },
    });

    return { ok: true, message: result.message };
  } catch (e) {
    const error = (e as Error).message;
    await prisma.mrpSyncAttempt.update({
      where: { id: attempt.id },
      data: {
        status: "failed",
        error,
        completedAt: new Date(),
      },
    });

    await prisma.mrpDocument.update({
      where: { id: documentId },
      data: { status: "sync_failed" },
    });

    return { ok: false, error };
  }
}
