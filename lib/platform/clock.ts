/**
 * Time source for the API platform (rate limiting, token expiry, proof-of-work expiry).
 * Tests inject a fake clock; production uses the system clock. Data-facing "today" logic uses
 * lib/opportunities/clock.ts instead, so the two can be controlled independently.
 */
let override: (() => number) | undefined;

export const nowMs = (): number => (override ? override() : Date.now());

export function setPlatformClock(fn: (() => number) | undefined): void {
  override = fn;
}
