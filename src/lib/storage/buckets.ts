import "server-only";

import { del, get, put } from "@vercel/blob";

/** Blob pathname prefix for original documents. */
const ORIGINALS_PREFIX = "mrp/originals";

/** Blob pathname for an original document: `mrp/originals/{userId}/{documentId}/{filename}`. */
export function buildOriginalPath(opts: {
  userId: string;
  documentId: string;
  filename: string;
}) {
  return `${ORIGINALS_PREFIX}/${opts.userId}/${opts.documentId}/${opts.filename}`;
}

export function buildThumbnailPath(opts: {
  userId: string;
  documentId: string;
}) {
  return `${ORIGINALS_PREFIX}/${opts.userId}/${opts.documentId}/thumb.jpg`;
}

/**
 * Upload an original document (image or PDF) to Vercel Blob as a private
 * blob. The calling API route has already authorized the user via
 * `getSessionUser()`; files are only served back through the authorized
 * `/api/documents/[id]/file` route.
 */
export async function uploadOriginal(
  path: string,
  body: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
) {
  const blob = await put(path, body as Blob | ArrayBuffer, {
    access: "private",
    contentType,
    addRandomSuffix: false,
  });
  return { path: blob.pathname };
}

export async function downloadOriginalBytes(path: string): Promise<Uint8Array> {
  const result = await get(path, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) {
    throw new Error(`Failed to download blob ${path}`);
  }
  const buf = await new Response(result.stream).arrayBuffer();
  return new Uint8Array(buf);
}

/**
 * Stream a private original for an already-authorized request. Returns null
 * when the blob is missing.
 */
export async function getOriginalStream(path: string) {
  const result = await get(path, { access: "private" });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return {
    stream: result.stream,
    contentType: result.blob.contentType || "application/octet-stream",
  };
}

export async function deleteOriginal(path: string) {
  await del(path);
}
