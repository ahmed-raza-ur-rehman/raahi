import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { ApiKeyRecord } from "../config";

/**
 * Partner API keys.
 *
 * Format: `rk.<id>.<secret>` where the secret is 32 random bytes (base64url). The `rk.` prefix makes leaked keys
 * easy to find with secret scanners. Only SHA-256(secret) is configured on the server - a fast hash is the right
 * tool here because the secret is high-entropy random data, not a human password (nothing to brute-force or
 * dictionary-attack). Comparison is constant-time and a missing key id costs the same as a wrong secret.
 */

const KEY_PATTERN = /^rk\.([a-z0-9][a-z0-9-]{2,23})\.([A-Za-z0-9_-]{43})$/;
const DUMMY_HASH = createHash("sha256").update("raahi-dummy").digest();

export const hashSecret = (secret: string): Buffer => createHash("sha256").update(secret).digest();

export const looksLikeApiKey = (credential: string): boolean => credential.startsWith("rk.");

/** Mint a key. Show `key` to the owner once; configure only `hash` (hex) on the server. */
export function generateApiKey(id: string): { key: string; id: string; hash: string } {
  if (!/^[a-z0-9][a-z0-9-]{2,23}$/.test(id)) throw new RangeError("id must be 3-24 chars of a-z, 0-9 and -");
  const secret = randomBytes(32).toString("base64url");
  return { id, key: `rk.${id}.${secret}`, hash: hashSecret(secret).toString("hex") };
}

/** The record the presented key belongs to, or undefined. Never throws on malformed input. */
export function verifyApiKey(presented: string, records: readonly ApiKeyRecord[]): ApiKeyRecord | undefined {
  const match = KEY_PATTERN.exec(presented);
  if (!match) return undefined;
  const [, id, secret] = match;
  const record = records.find((candidate) => candidate.id === id);
  const expected = record ? Buffer.from(record.hash, "hex") : DUMMY_HASH;
  const equal = timingSafeEqual(hashSecret(secret), expected);
  return record && equal ? record : undefined;
}

/** Constant-time comparison of two secrets of any length (both are hashed first, so lengths do not leak). */
export function secretsMatch(presented: string, expected: string): boolean {
  return timingSafeEqual(hashSecret(presented), hashSecret(expected));
}
