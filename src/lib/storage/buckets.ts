import "server-only";

import { env } from "@/lib/env";
import { getServerSupabase, getServiceSupabase } from "@/lib/auth/supabase-server";

export const ORIGINALS_BUCKET = env.SUPABASE_BUCKET_ORIGINALS;
export const THUMBNAILS_BUCKET = env.SUPABASE_BUCKET_THUMBNAILS;

/** Object path inside the `originals` bucket: `{userId}/{documentId}/{filename}`. */
export function buildOriginalPath(opts: {
  userId: string;
  documentId: string;
  filename: string;
}) {
  return `${opts.userId}/${opts.documentId}/${opts.filename}`;
}

export function buildThumbnailPath(opts: {
  userId: string;
  documentId: string;
}) {
  return `${opts.userId}/${opts.documentId}/thumb.jpg`;
}

/**
 * Upload an original document (image or PDF). Uses the user's session client so
 * Storage RLS can enforce per-user access.
 */
export async function uploadOriginal(
  path: string,
  body: Blob | ArrayBuffer | Uint8Array,
  contentType: string,
) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .upload(path, body, {
      contentType,
      upsert: false,
    });
  if (error) throw error;
  return data;
}

export async function downloadOriginalBytes(path: string): Promise<Uint8Array> {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .download(path);
  if (error) throw error;
  const arrayBuf = await data.arrayBuffer();
  return new Uint8Array(arrayBuf);
}

/**
 * Get a signed URL for displaying an original file in the browser. Defaults
 * to a 1-hour expiry — refresh if shown for a long time.
 */
export async function getOriginalSignedUrl(
  path: string,
  expiresInSec = 60 * 60,
) {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error) throw error;
  return data.signedUrl;
}

/** Bypass-RLS download (server-side only — uses service-role key). */
export async function downloadOriginalBytesAsAdmin(
  path: string,
): Promise<Uint8Array> {
  const supabase = getServiceSupabase();
  const { data, error } = await supabase.storage
    .from(ORIGINALS_BUCKET)
    .download(path);
  if (error) throw error;
  const arrayBuf = await data.arrayBuffer();
  return new Uint8Array(arrayBuf);
}
