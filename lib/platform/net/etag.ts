import { createHash } from "node:crypto";

/** Weak ETag derived from the serialised body. Weak because gzip/brotli may re-encode the same representation. */
export const etagOf = (body: string): string => `W/"${createHash("sha256").update(body).digest("base64url").slice(0, 22)}"`;

const opaque = (tag: string) => tag.trim().replace(/^W\//, "");

/** RFC 9110 `If-None-Match` using weak comparison; `*` matches any current representation. */
export function ifNoneMatchHits(header: string | null, etag: string): boolean {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const current = opaque(etag);
  return header.split(",").some((candidate) => opaque(candidate) === current);
}
