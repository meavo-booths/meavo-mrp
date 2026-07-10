import "server-only";

import { after } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getZeronAdapter } from "./factory";

/**
 * Queue a sync attempt for a document and return immediately.
 *
 * The attempt row is committed as `queued` before the response is sent (so
 * work is never silently dropped), and the actual adapter push runs via
 * `after()` once the response has flushed — approve/retry requests no longer
 * block on the adapter.
 */
export async function enqueueZeronSync(opts: {
  documentId: string;
  requestedBy: string;
}) {
  const { documentId } = opts;
  const adapter = getZeronAdapter();

  const attempt = await prisma.$transaction(async (tx) => {
    // Mark older attempts as not-current.
    await tx.mrpSyncAttempt.updateMany({
      where: { documentId, isCurrent: true },
      data: { isCurrent: false },
    });

    return tx.mrpSyncAttempt.create({
      data: {
        documentId,
        adapter: adapter.name,
        status: "queued",
        isCurrent: true,
      },
    });
  });

  after(() => processZeronSyncAttempt(attempt.id));

  return { ok: true, queued: true, attemptId: attempt.id };
}

/** Run one queued sync attempt: push to the adapter and record the outcome. */
export async function processZeronSyncAttempt(attemptId: string) {
  const attempt = await prisma.mrpSyncAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt || attempt.status !== "queued") {
    return { ok: false, error: "Attempt not found or already processed" };
  }

  const { documentId } = attempt;
  const adapter = getZeronAdapter();

  await prisma.mrpSyncAttempt.update({
    where: { id: attemptId },
    data: { status: "running" },
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
      where: { id: attemptId },
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
      where: { id: attemptId },
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
