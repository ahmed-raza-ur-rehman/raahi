import type { ApiScope } from "../config";

/**
 * Who is calling. Produced once per request by `authenticate` and consumed by the route pipeline
 * (authorisation, rate-limit tier, logging).
 *
 *  - anonymous: no credential. Read-only public data, tightest limits.
 *  - device:    short-lived token from the proof-of-work registration flow (the Android app). Identifies an
 *               *install*, not a person - RAAHI has no user accounts and stores no personal data.
 *  - client:    a partner application authenticated by an API key (the sibling apps, the embed widget's host).
 *  - admin:     the operator (refresh, metrics); a single secret, never accepted on public routes.
 */
export type Principal =
  | { tier: "anonymous"; id: string }
  | { tier: "device"; id: string; scopes: readonly ApiScope[] }
  | { tier: "client"; id: string; scopes: readonly ApiScope[]; rpm: number }
  | { tier: "admin"; id: "admin" };

export const ANONYMOUS_SCOPES: readonly ApiScope[] = ["read"];

export function scopesOf(principal: Principal): readonly ApiScope[] {
  if (principal.tier === "anonymous") return ANONYMOUS_SCOPES;
  if (principal.tier === "admin") return ["read", "tools", "assistant"];
  return principal.scopes;
}

export const hasScope = (principal: Principal, scope: ApiScope): boolean => scopesOf(principal).includes(scope);
