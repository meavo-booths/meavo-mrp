import { createHash } from "node:crypto";

/** SHA-256 hex digest of bytes. Used to dedupe re-uploads of the same image. */
export function sha256Hex(bytes: Uint8Array | ArrayBuffer): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return createHash("sha256").update(buf).digest("hex");
}
