import type { GcraResult } from "./gcra";
import { getRateLimitStore, type RateLimitStore } from "./store";

/**
 * Named rate-limit policies. The numbers are the *anonymous* baseline (requests per minute and burst); other tiers
 * scale them (device tokens x4, API keys by their own rpm). They are deliberately modest: the data is public and
 * CDN-cached, so legitimate clients rarely reach the origin; the expensive endpoints (search, tools, assistant,
 * registration) are the tightest. Rationale and abuse cases: docs/security/rate-limiting.md.
 */
export const RATE_POLICIES = {
  health: { rpm: 120, burst: 60 },
  read: { rpm: 90, burst: 45 },
  search: { rpm: 45, burst: 20 },
  tools: { rpm: 20, burst: 10 },
  assistant: { rpm: 8, burst: 4 },
  // Registration is gated by proof of work, so this is a backstop. It is generous because many phones share one
  // carrier-grade-NAT address in Pakistan; per-install tokens exist precisely so those users are not punished.
  auth: { rpm: 30, burst: 15 },
  // Failed credentials only: stops guessing a secret at wire speed.
  authfail: { rpm: 20, burst: 10 },
  admin: { rpm: 20, burst: 5 },
  // The original cookie-session web endpoints. `chat` and `ocr` call paid models; `submit` writes to a review queue.
  chat: { rpm: 30, burst: 10 },
  chatSession: { rpm: 12, burst: 6 },
  ocr: { rpm: 10, burst: 4 },
  submit: { rpm: 2, burst: 2 },
  cases: { rpm: 60, burst: 20 },
} as const;

export type PolicyName = keyof typeof RATE_POLICIES;
export type Tier = "anonymous" | "device" | "client" | "admin";

export const DEVICE_MULTIPLIER = 4;

export interface LimitRequest {
  policy: PolicyName;
  tier: Tier;
  /** Stable identity within the tier: hashed IP, device id or key id. */
  subject: string;
  /** Extra scaling for the tier (device 4x, API key rpm / baseline). */
  multiplier?: number;
  /** Global operations knob from configuration. */
  scale?: number;
  nowMs: number;
  store?: RateLimitStore;
}

export interface LimitDecision extends GcraResult {
  policy: PolicyName;
  /** Requests per window. */
  limit: number;
  windowSeconds: number;
}

export async function checkRateLimit(request: LimitRequest): Promise<LimitDecision> {
  const base = RATE_POLICIES[request.policy];
  const factor = (request.multiplier ?? 1) * (request.scale ?? 1);
  const limit = Math.max(1, Math.ceil(base.rpm * factor));
  const burst = Math.max(1, Math.ceil(base.burst * factor));
  const store = request.store ?? getRateLimitStore();
  const key = `${request.policy}|${request.tier}|${request.subject}`;
  const result = await store.hit(key, request.nowMs, { intervalMs: 60_000 / limit, burst });
  return { ...result, policy: request.policy, limit, windowSeconds: 60 };
}

/**
 * Headers for clients. Legacy `RateLimit-*` trio (widely understood) plus `RateLimit-Policy` from the IETF
 * httpapi draft, and `Retry-After` whenever the request was rejected.
 */
export function rateLimitHeaders(decision: LimitDecision): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Remaining": String(Math.max(0, decision.remaining)),
    "RateLimit-Reset": String(Math.max(0, Math.ceil(decision.resetAfterMs / 1000))),
    "RateLimit-Policy": `${decision.limit};w=${decision.windowSeconds}`,
  };
  if (!decision.allowed) headers["Retry-After"] = String(Number.isFinite(decision.retryAfterMs) ? Math.max(1, Math.ceil(decision.retryAfterMs / 1000)) : 3600);
  return headers;
}
