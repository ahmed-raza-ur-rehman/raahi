import type { PlatformConfig } from "../config";

/**
 * CORS policy.
 *
 *  - `public`: read-only public data and bearer-token endpoints. `Access-Control-Allow-Origin: *` is safe because
 *    these endpoints never use ambient credentials (cookies), so a malicious page cannot ride a victim's session.
 *  - `restricted`: anything cookie-authenticated or otherwise sensitive. Only exact origins from the allow-list are
 *    echoed back (with `Vary: Origin`); there is no wildcard and credentials are never allowed cross-origin.
 */
export type CorsMode = "public" | "restricted";

export const ALLOWED_REQUEST_HEADERS = "Authorization, Content-Type, If-None-Match, X-Request-Id";
export const EXPOSED_RESPONSE_HEADERS = "ETag, X-Request-Id, RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, RateLimit-Policy, Retry-After, Deprecation, Sunset";

export function corsHeaders(mode: CorsMode, origin: string | null, config: Pick<PlatformConfig, "corsOrigins">, methods: readonly string[]): Record<string, string> {
  const allowMethods = [...new Set([...methods, "OPTIONS"])].join(", ");
  if (mode === "public") {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": allowMethods,
      "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
      "Access-Control-Expose-Headers": EXPOSED_RESPONSE_HEADERS,
      "Access-Control-Max-Age": "600",
    };
  }
  const headers: Record<string, string> = { Vary: "Origin" };
  if (origin && config.corsOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = allowMethods;
    headers["Access-Control-Allow-Headers"] = ALLOWED_REQUEST_HEADERS;
    headers["Access-Control-Expose-Headers"] = EXPOSED_RESPONSE_HEADERS;
    headers["Access-Control-Max-Age"] = "600";
  }
  return headers;
}

/**
 * Cross-site request check for cookie-authenticated, state-changing endpoints (defence in depth on top of
 * SameSite cookies). Browsers always send `Sec-Fetch-Site` and, for cross-origin POSTs, `Origin`; non-browser clients
 * (curl, the mobile app) send neither and carry no ambient cookies, so they are not a CSRF vector and are allowed.
 */
export function isCrossSiteWrite(headers: Headers, requestOrigin: string, config: Pick<PlatformConfig, "corsOrigins">): boolean {
  const site = headers.get("sec-fetch-site");
  if (site === "cross-site") return !isAllowedOrigin(headers.get("origin"), requestOrigin, config);
  const origin = headers.get("origin");
  if (origin !== null && origin !== "null") return !isAllowedOrigin(origin, requestOrigin, config);
  if (origin === "null") return true;
  return false;
}

function isAllowedOrigin(origin: string | null, requestOrigin: string, config: Pick<PlatformConfig, "corsOrigins">): boolean {
  return origin !== null && (origin === requestOrigin || config.corsOrigins.includes(origin));
}
