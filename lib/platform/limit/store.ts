import { gcra, type GcraParams, type GcraResult } from "./gcra";

/**
 * Where rate-limit state lives. `hit` must be atomic per key. The in-memory store below is exact for one process;
 * on serverless platforms every instance has its own memory, so limits are per instance (best effort) unless a
 * shared store is plugged in - see docs/security/rate-limiting.md for the Redis/Lua recipe that mirrors `gcra`.
 */
export interface RateLimitStore {
  hit(key: string, nowMs: number, params: GcraParams): GcraResult | Promise<GcraResult>;
}

interface Entry {
  tat: number;
  expiresAt: number;
}

/**
 * Bounded in-memory store. State for a key is exactly its TAT and it becomes irrelevant once the TAT is in the past,
 * so entries expire on their own. Memory is capped: when `maxKeys` is exceeded expired entries are swept first and,
 * if that is not enough, the oldest tenth is dropped (an evicted client simply gets a fresh bucket - the safe
 * direction for availability, and bounded for an attacker rotating identities).
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly maxKeys = 50_000) {}

  hit(key: string, nowMs: number, params: GcraParams): GcraResult {
    const entry = this.entries.get(key);
    const result = gcra(entry && entry.expiresAt > nowMs ? entry.tat : undefined, nowMs, params);
    if (result.allowed) {
      this.entries.delete(key); // re-insert so iteration order approximates recency
      this.entries.set(key, { tat: result.nextTat, expiresAt: result.nextTat });
      if (this.entries.size > this.maxKeys) this.evict(nowMs);
    }
    return result;
  }

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private evict(nowMs: number): void {
    for (const [key, entry] of this.entries) if (entry.expiresAt <= nowMs) this.entries.delete(key);
    if (this.entries.size <= this.maxKeys) return;
    const drop = Math.max(1, Math.ceil(this.maxKeys / 10));
    let removed = 0;
    for (const key of this.entries.keys()) {
      this.entries.delete(key);
      if (++removed >= drop) break;
    }
  }
}

const globalKey = Symbol.for("raahi.platform.rateLimitStore");
const holder = globalThis as unknown as Record<symbol, RateLimitStore | undefined>;

/** Process-wide store (survives dev hot reloads). */
export function getRateLimitStore(): RateLimitStore {
  return (holder[globalKey] ??= new MemoryRateLimitStore());
}

/** Tests / alternative deployments: install a different store. */
export function setRateLimitStore(store: RateLimitStore | undefined): void {
  holder[globalKey] = store;
}
