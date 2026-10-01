/**
 * "Always keep a plan B."
 *
 * Every AI feature in Raahi already has a fallback. This module makes sure the
 * fallback is reached *quickly* and *reliably*:
 *
 *  - A circuit breaker per provider. After a few consecutive failures we stop
 *    calling it for a while and go straight to the fallback, instead of making
 *    every visitor wait out a timeout on a service we already know is down.
 *  - A hard deadline on every call, independent of the SDK's own timeout.
 *  - One retry for genuinely transient faults (a dropped connection), because
 *    the first failure is often not the provider's fault.
 *
 * The breaker is in-memory and per-instance, which is the right granularity:
 * it protects this process's visitors. It is not a distributed control plane,
 * and it never blocks a request that could be answered locally.
 */

export type ProviderName =
  | "dashscope-chat"
  | "dashscope-vision"
  | "dashscope-audio"
  | "dashscope-embeddings";

interface Circuit {
  failures: number;
  openedAt?: number;
  lastError?: string;
}

const FAILURE_THRESHOLD = 3;
const OPEN_MS = 30_000;
const HALF_OPEN_AFTER = OPEN_MS;

const circuits = new Map<ProviderName, Circuit>();

function circuit(name: ProviderName): Circuit {
  const existing = circuits.get(name);
  if (existing) return existing;
  const created: Circuit = { failures: 0 };
  circuits.set(name, created);
  return created;
}

export function isCircuitOpen(name: ProviderName): boolean {
  const state = circuit(name);
  if (!state.openedAt) return false;
  if (Date.now() - state.openedAt >= HALF_OPEN_AFTER) return false; // half-open: let one through
  return true;
}

export function recordSuccess(name: ProviderName): void {
  circuits.set(name, { failures: 0 });
}

export function recordFailure(name: ProviderName, error: unknown): void {
  const state = circuit(name);
  state.failures += 1;
  state.lastError = error instanceof Error ? error.message : String(error);
  if (state.failures >= FAILURE_THRESHOLD) state.openedAt = Date.now();
}

/** Snapshot for the health endpoint and for debugging a bad deployment. */
export function providerHealth(): Record<
  string,
  { open: boolean; failures: number; lastError?: string; retryInSeconds: number }
> {
  const names: ProviderName[] = ["dashscope-chat", "dashscope-vision", "dashscope-audio", "dashscope-embeddings"];
  const snapshot: Record<string, ReturnType<typeof describe>> = {};
  for (const name of names) snapshot[name] = describe(name);
  return snapshot;
}

function describe(name: ProviderName) {
  const state = circuit(name);
  const open = isCircuitOpen(name);
  return {
    open,
    failures: state.failures,
    ...(state.lastError ? { lastError: state.lastError } : {}),
    retryInSeconds: open && state.openedAt ? Math.max(0, Math.ceil((HALF_OPEN_AFTER - (Date.now() - state.openedAt)) / 1000)) : 0,
  };
}

export interface WithProviderOptions<T> {
  /** Hard deadline for the attempt, in milliseconds. */
  timeoutMs: number;
  /** The provider call. Must be a fresh promise each retry, so pass a function. */
  call: () => Promise<T>;
  /** What to do instead. Called immediately when the breaker is open. */
  fallback: () => T | Promise<T>;
  /** Retry once on a transient failure. Default true. */
  retry?: boolean;
  /** Logged, never shown to a visitor. */
  label?: string;
}

/** True for faults worth one more attempt; false for "the key is wrong" etc. */
function isTransient(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes("timeout") ||
    message.includes("timed out") ||
    message.includes("econnreset") ||
    message.includes("econnrefused") ||
    message.includes("socket") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("429") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500")
  );
}

function withDeadline<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Run a provider call with a deadline, one retry and a guaranteed fallback.
 * Never throws: the caller always gets either the provider's answer or the
 * fallback.
 */
export async function withProvider<T>(name: ProviderName, options: WithProviderOptions<T>): Promise<T> {
  const { timeoutMs, call, fallback, retry = true, label = name } = options;

  if (isCircuitOpen(name)) {
    // Known-down provider: skip straight to plan B rather than making the
    // visitor wait for a timeout we have already seen fail three times.
    return fallback();
  }

  const attempts = retry ? 2 : 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const value = await withDeadline(call(), timeoutMs, label);
      recordSuccess(name);
      return value;
    } catch (error) {
      lastError = error;
      if (attempt < attempts && !isTransient(error)) break; // a bad key will not fix itself
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }

  recordFailure(name, lastError);
  console.warn(`[raahi] provider ${name} failed, using fallback:`, lastError);
  return fallback();
}
