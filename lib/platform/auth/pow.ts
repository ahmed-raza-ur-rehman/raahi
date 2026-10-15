import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { PlatformConfig } from "../config";
import { ApiError } from "../errors";
import { b64url, randomToken } from "../ids";

/**
 * Stateless proof-of-work challenges for anonymous device registration (Hashcash family; the same idea as
 * Altcha / mCaptcha / Anubis, specialised for a mobile client).
 *
 * Why: RAAHI has no accounts, so there is no one to rate-limit by identity. A token must therefore cost something to
 * obtain; otherwise an attacker could mint unlimited identities and defeat per-identity limits. A mid-range phone
 * solves the default difficulty in a fraction of a second; a farm minting thousands per minute pays real CPU.
 *
 * Protocol (docs/api/authentication.md):
 *   1. GET  /api/v1/auth/challenge -> { challenge, difficulty, expiresAt }
 *   2. client finds an integer `nonce` such that SHA-256("<salt>:<nonce>") has >= `difficulty` leading zero bits
 *   3. POST /api/v1/auth/device { challenge, nonce, installId, platform } -> access token
 *
 * The challenge is `<payload>.<hmac>`: signed with a server secret so the server stores nothing, expires in
 * minutes, and difficulty is adaptive (rises with the recent issue rate, so a burst of registrations gets
 * progressively more expensive). Replay of one solution is limited by a bounded per-process guard.
 */

const CHALLENGE_TTL_SECONDS = 300;

const payloadSchema = z.object({
  v: z.literal(1),
  /** Random salt (base64url). */
  s: z.string().min(16).max(64),
  /** Difficulty in leading zero bits. */
  d: z.number().int().min(1).max(32),
  /** Expiry, unix seconds. */
  e: z.number().int(),
  /** Key id used to sign. */
  k: z.string().min(1).max(16),
});
export type PowPayload = z.infer<typeof payloadSchema>;

export const leadingZeroBits = (digest: Uint8Array): number => {
  let bits = 0;
  for (const byte of digest) {
    if (byte === 0) {
      bits += 8;
      continue;
    }
    bits += Math.clz32(byte) - 24;
    break;
  }
  return bits;
};

export const powDigest = (salt: string, nonce: number | string): Buffer => createHash("sha256").update(`${salt}:${nonce}`).digest();

const sign = (payloadB64: string, key: Uint8Array): Buffer => createHmac("sha256", key).update(payloadB64).digest();

export interface IssuedChallenge {
  challenge: string;
  algorithm: "sha256-leading-zero-bits";
  difficulty: number;
  expiresAt: string;
}

export function issueChallenge(config: Pick<PlatformConfig, "tokenSecrets">, difficulty: number, nowSeconds: number): IssuedChallenge {
  const signer = config.tokenSecrets[0];
  if (!signer) throw new ApiError("not_configured", "Device registration is not enabled on this deployment.");
  const payload: PowPayload = { v: 1, s: randomToken(16), d: difficulty, e: nowSeconds + CHALLENGE_TTL_SECONDS, k: signer.kid };
  const payloadB64 = b64url.encode(JSON.stringify(payload));
  return {
    challenge: `${payloadB64}.${b64url.encode(sign(payloadB64, signer.key))}`,
    algorithm: "sha256-leading-zero-bits",
    difficulty,
    expiresAt: new Date(payload.e * 1000).toISOString(),
  };
}

const invalid = (message: string) => new ApiError("challenge_invalid", message);

/** Verify signature, expiry and the work itself. Returns the payload (its `s` salt identifies the challenge). */
export function verifySolution(config: Pick<PlatformConfig, "tokenSecrets">, input: { challenge: string; nonce: string }, nowSeconds: number): PowPayload & { sig: string } {
  const parts = input.challenge.split(".");
  if (parts.length !== 2 || parts[0].length > 400 || parts[1].length > 100) throw invalid("The challenge is malformed.");
  const [payloadB64, sigB64] = parts;

  let payload: PowPayload;
  try {
    payload = payloadSchema.parse(JSON.parse(b64url.decode(payloadB64).toString("utf8")));
  } catch {
    throw invalid("The challenge is malformed.");
  }
  const secret = config.tokenSecrets.find((candidate) => candidate.kid === payload.k);
  if (!secret) throw invalid("The challenge was signed with an unknown key.");

  const expected = sign(payloadB64, secret.key);
  const presented = b64url.decode(sigB64);
  if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) throw invalid("The challenge signature is wrong.");
  if (payload.e <= nowSeconds) throw invalid("The challenge has expired; request a new one.");
  if (payload.e - nowSeconds > CHALLENGE_TTL_SECONDS + 5) throw invalid("The challenge expiry is out of range.");

  if (!/^\d{1,16}$/.test(input.nonce)) throw invalid("The nonce must be a non-negative integer.");
  if (leadingZeroBits(powDigest(payload.s, input.nonce)) < payload.d) throw invalid("The proof of work does not meet the required difficulty.");
  return { ...payload, sig: sigB64 };
}

/** Reference solver (tests, scripts, and any JavaScript client). The Android app ports exactly this loop. */
export function solveChallenge(challenge: string, maxIterations = 50_000_000): string {
  const payload = payloadSchema.parse(JSON.parse(b64url.decode(challenge.split(".")[0]).toString("utf8")));
  for (let nonce = 0; nonce < maxIterations; nonce++) {
    if (leadingZeroBits(powDigest(payload.s, nonce)) >= payload.d) return String(nonce);
  }
  throw new RangeError("no solution found within the iteration budget");
}

/**
 * Adaptive difficulty: every doubling of the recent issue rate (above a quiet baseline) adds one bit, up to the
 * configured maximum. Rate is counted over a sliding window held in memory (per process).
 */
export class DifficultyController {
  private readonly issued: number[] = [];

  constructor(private readonly windowMs = 60_000, private readonly quiet = 20) {}

  record(nowMs: number): void {
    this.issued.push(nowMs);
    this.prune(nowMs);
  }

  difficulty(nowMs: number, powBits: { base: number; max: number }): number {
    this.prune(nowMs);
    const extra = Math.floor(Math.log2(1 + this.issued.length / this.quiet));
    return Math.min(powBits.max, powBits.base + extra);
  }

  private prune(nowMs: number): void {
    while (this.issued.length > 0 && this.issued[0] <= nowMs - this.windowMs) this.issued.shift();
    if (this.issued.length > 5_000) this.issued.splice(0, this.issued.length - 5_000);
  }
}

/** Remembers solved challenges until they expire so one solution cannot mint unlimited tokens (per process). */
export class ReplayGuard {
  private readonly seen = new Map<string, number>();

  constructor(private readonly maxEntries = 10_000) {}

  /** True the first time `id` is seen, false on replay. */
  claim(id: string, expiresAtSeconds: number, nowSeconds: number): boolean {
    for (const [key, expiry] of this.seen) {
      if (expiry > nowSeconds) break; // insertion order is roughly expiry order
      this.seen.delete(key);
    }
    if (this.seen.has(id)) return false;
    this.seen.set(id, expiresAtSeconds);
    if (this.seen.size > this.maxEntries) this.seen.delete(this.seen.keys().next().value as string);
    return true;
  }
}

const globalKey = Symbol.for("raahi.platform.pow");
const holder = globalThis as unknown as Record<symbol, { difficulty: DifficultyController; replay: ReplayGuard } | undefined>;

export function getPowState(): { difficulty: DifficultyController; replay: ReplayGuard } {
  return (holder[globalKey] ??= { difficulty: new DifficultyController(), replay: new ReplayGuard() });
}

export function resetPowStateForTests(): void {
  holder[globalKey] = undefined;
}
