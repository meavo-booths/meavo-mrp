import "server-only";

import { eq, and } from "drizzle-orm";

import { db, schema } from "@/lib/db/client";
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
  await db
    .update(schema.syncAttempts)
    .set({ isCurrent: false })
    .where(
      and(
        eq(schema.syncAttempts.documentId, documentId),
        eq(schema.syncAttempts.isCurrent, true),
      ),
    );

  const [attempt] = await db
    .insert(schema.syncAttempts)
    .values({
      documentId,
      adapter: adapter.name,
      status: "running",
      isCurrent: true,
    })
    .returning();

  try {
    const document = await db.query.documents.findFirst({
      where: eq(schema.documents.id, documentId),
    });
    if (!document) throw new Error("Document not found");

    const supplier = document.supplierId
      ? (await db.query.suppliers.findFirst({
          where: eq(schema.suppliers.id, document.supplierId),
        })) ?? null
      : null;

    const lineItems = await db.query.lineItems.findMany({
      where: eq(schema.lineItems.documentId, documentId),
      orderBy: (li, { asc }) => [asc(li.position)],
    });

    const result = await adapter.pushDocument({
      document,
      supplier,
      lineItems,
    });

    await db
      .update(schema.syncAttempts)
      .set({
        status: "succeeded",
        response: result.raw ?? { message: result.message },
        completedAt: new Date(),
      })
      .where(eq(schema.syncAttempts.id, attempt.id));

    await db
      .update(schema.documents)
      .set({
        status: "synced",
        syncedAt: new Date(),
        zeronId: result.externalId ?? document.zeronId ?? null,
      })
      .where(eq(schema.documents.id, documentId));

    return { ok: true, message: result.message };
  } catch (e) {
    const error = (e as Error).message;
    await db
      .update(schema.syncAttempts)
      .set({
        status: "failed",
        error,
        completedAt: new Date(),
      })
      .where(eq(schema.syncAttempts.id, attempt.id));

    await db
      .update(schema.documents)
      .set({ status: "sync_failed" })
      .where(eq(schema.documents.id, documentId));

    return { ok: false, error };
  }
}
