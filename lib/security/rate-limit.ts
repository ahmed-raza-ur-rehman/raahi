/**
 * Inbound rate limiting for the public API.
 *
 * RAAHI's endpoints are open by design — a citizen in a hurry must not hit a
 * login wall — so the protection has to be a rate limit instead.
 *
 * This is deliberately in-memory and dependency-free. On a single server it is
 * exact; on serverless each instance keeps its own counters, so the effective
 * limit is `limit × instances`. That is the right trade-off: an approximate
 * ceiling that costs nothing beats a distributed counter that needs Redis and
 * adds a failure mode to a service people rely on in emergencies.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Reap expired buckets so a long-running server does not grow forever. */
let lastSweep = Date.now();
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in this window. */
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
  limit: number;
}

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0, limit };
  }

  existing.count += 1;
  const allowed = existing.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - existing.count),
    retryAfter: Math.ceil((existing.resetAt - now) / 1000),
    limit,
  };
}

/**
 * Per-route budgets. Endpoints that reach a paid model or a third-party API get
 * a small budget; cheap local reads get a generous one.
 */
export const API_BUDGETS: Record<string, { limit: number; windowMs: number }> = {
  // Reaches an LLM / vision / TTS provider: expensive.
  "/api/ask": { limit: 20, windowMs: 60_000 },
  "/api/chat": { limit: 20, windowMs: 60_000 },
  "/api/vision": { limit: 10, windowMs: 60_000 },
  "/api/ocr": { limit: 10, windowMs: 60_000 },
  "/api/translate": { limit: 30, windowMs: 60_000 },
  "/api/web/search": { limit: 15, windowMs: 60_000 },
  "/api/navigate": { limit: 30, windowMs: 60_000 },
  "/api/recommend": { limit: 30, windowMs: 60_000 },
  // Writes (blood requests, relief requests, corrections): spam here wastes
  // the time of volunteers who act on them.
  "/api/blood": { limit: 10, windowMs: 60_000 },
  "/api/disaster": { limit: 10, windowMs: 60_000 },
  "/api/corrections": { limit: 10, windowMs: 60_000 },
  // Everything else is a local SQLite read.
  default: { limit: 120, windowMs: 60_000 },
};

export function budgetFor(pathname: string): { limit: number; windowMs: number } {
  return API_BUDGETS[pathname] ?? API_BUDGETS.default;
}

/** Best-effort client identity. Never throws, never blocks. */
export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Anonymous cookie we hand a visitor so they get their own budget.
 *
 * Pakistan's mobile networks put thousands of people behind a single
 * carrier-grade NAT address. Keying only on IP would mean the first person to
 * search for a scholarship could lock out an entire city. So the tight budget
 * is per visitor, and the IP only carries a generous ceiling to catch someone
 * hammering us.
 *
 * It is a random string and nothing else: no login, no profile, no tracking.
 */
export const VISITOR_COOKIE = "raahi_vid";

export function newVisitorId(): string {
  return crypto.randomUUID();
}

export function readVisitorId(request: Request): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === VISITOR_COOKIE) {
      const value = rest.join("=").trim();
      if (value.length > 0) return value.slice(0, 64);
    }
  }
  return undefined;
}

/**
 * A short, stable hash of the browser's own headers, used only until the
 * visitor has a cookie (their very first request). Deliberately excludes the
 * IP: including it would re-create the shared-address problem this solves.
 */
function browserFingerprint(request: Request): string {
  const material = [request.headers.get("user-agent") ?? "", request.headers.get("accept-language") ?? ""].join("|");

  let hash = 2166136261;
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/**
 * How many legitimate visitors may share one address before we treat it as
 * abuse. Generous on purpose - a university, an internet cafe and a whole
 * mobile carrier can all sit behind one IP.
 */
const IP_HEADROOM = 25;
const IP_ABSOLUTE_CEILING = 600;

function ipCeiling(limit: number): number {
  return Math.min(limit * IP_HEADROOM, IP_ABSOLUTE_CEILING);
}

/**
 * Enforce both budgets and return the tighter answer.
 *
 * Tier 1 - the visitor: the budget a real person experiences.
 * Tier 2 - the address: a loose ceiling, so that rotating cookies does not buy
 * an attacker unlimited requests from one place.
 */
export function rateLimitRequest(request: Request, pathname: string): RateLimitResult {
  const budget = budgetFor(pathname);

  const visitor = readVisitorId(request) ?? `ua:${browserFingerprint(request)}`;
  const perVisitor = rateLimit(`v:${visitor}:${pathname}`, budget.limit, budget.windowMs);
  const perIp = rateLimit(`ip:${clientKey(request)}:${pathname}`, ipCeiling(budget.limit), budget.windowMs);

  // Either bucket being exhausted is enough to say no.
  if (!perVisitor.allowed) return perVisitor;
  if (!perIp.allowed) return perIp;

  // Both allowed: report the tighter one so the header is honest.
  return perVisitor.remaining <= perIp.remaining ? perVisitor : perIp;
}
