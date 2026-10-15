/**
 * Generic Cell Rate Algorithm (GCRA) - the algorithm behind redis-cell and the `throttled` Go library.
 *
 * Why GCRA rather than a fixed window or a token bucket:
 *  - one number of state per key (the "theoretical arrival time", TAT), so memory is O(keys);
 *  - no boundary effect (a fixed window lets a client burst 2x the limit across a window edge);
 *  - exact `retryAfter` and `resetAfter` with no background refill timer.
 *
 * The function is pure (state in, state out) so it is unit- and property-tested without a clock, and any store
 * (memory, Redis via a Lua mirror) can host it atomically.
 */

export interface GcraParams {
  /** Emission interval T: milliseconds of "credit" one request consumes (window / limit). */
  intervalMs: number;
  /** How many requests may arrive back-to-back after a quiet period. */
  burst: number;
  /** Cost of this request in cells (default 1). */
  cost?: number;
}

export interface GcraResult {
  allowed: boolean;
  /** Whole requests that could still be made immediately after this one (0 when limited). */
  remaining: number;
  /** When limited: milliseconds until this request would be allowed. 0 when allowed. */
  retryAfterMs: number;
  /** Milliseconds until the bucket is completely empty again (full burst available). */
  resetAfterMs: number;
  /** The TAT to persist. Unchanged when the request is limited. */
  nextTat: number;
}

export function gcra(previousTat: number | undefined, nowMs: number, params: GcraParams): GcraResult {
  const interval = params.intervalMs;
  const cost = params.cost ?? 1;
  if (!(interval > 0) || !(params.burst >= 1) || !(cost > 0)) throw new RangeError("gcra: intervalMs, burst and cost must be positive");

  const increment = interval * cost;
  const tolerance = interval * params.burst;
  const tat = Math.max(previousTat ?? nowMs, nowMs);
  const newTat = tat + increment;
  const allowAt = newTat - tolerance;
  const diff = nowMs - allowAt;

  if (diff < 0) {
    return {
      allowed: false,
      remaining: Math.max(0, Math.floor((nowMs - (tat - tolerance)) / interval)),
      retryAfterMs: increment > tolerance ? Number.POSITIVE_INFINITY : -diff,
      resetAfterMs: tat - nowMs,
      nextTat: tat,
    };
  }
  return { allowed: true, remaining: Math.floor(diff / interval), retryAfterMs: 0, resetAfterMs: newTat - nowMs, nextTat: newTat };
}
