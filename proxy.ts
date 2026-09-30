import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { newVisitorId, rateLimitRequest, readVisitorId, VISITOR_COOKIE } from "@/lib/security/rate-limit";

/**
 * Security headers on every response.
 *
 * The app handles real citizen data (CNICs, phone numbers, medical need), so
 * the baseline hardening belongs in one place rather than per-route.
 */
function securityHeaders(response: NextResponse, isProduction: boolean, csp: string): NextResponse {
  // Never let a browser second-guess a declared content type.
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Stop this page being framed by someone else (clickjacking).
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Turn off features this app does not need: microphone and camera are handled
  // through explicit user gestures, so declaring them here is only a guard.
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(), interest-cohort=()",
  );

  response.headers.set("X-DNS-Prefetch-Control", "on");

  if (isProduction) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  response.headers.set("Content-Security-Policy", csp);

  return response;
}

/**
 * Content-Security-Policy, built around a fresh per-request nonce.
 *
 * There is no 'unsafe-inline' here any more. Next.js reads the nonce out of the
 * request header below and attaches it to the framework scripts, the page
 * bundles and any style it generates itself, so the app loads normally while an
 * injected inline script has nothing to match and is refused.
 *
 * `'strict-dynamic'` means a nonced script may load its own dependencies, which
 * is what lets the bundles work without listing every chunk hash.
 */
export function buildCsp(nonce: string, isProduction: boolean): string {
  // React uses eval in development to rebuild server error stacks. Neither
  // React nor Next use eval in production.
  const scriptSrc = `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProduction ? "" : " 'unsafe-eval'"}`;

  return [
    "default-src 'self'",
    scriptSrc,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com data:",
    // Photos are captured to object URLs / data URLs by the document scanner.
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    ...(isProduction ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * The cookie is httpOnly so a page script cannot read or rewrite it, and
 * first-party so it only ever reaches us.
 */
function setVisitorCookie(response: NextResponse, value: string, isProduction: boolean): void {
  response.cookies.set({
    name: VISITOR_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: isProduction,
  });
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";

  // A fresh, unpredictable value per request. Set on the request so Next can
  // stamp it onto the scripts it emits, and on the response so the browser
  // enforces it.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, isProduction);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  /**
   * Give every visitor their own anonymous id, so that thousands of people
   * sharing one carrier-NAT address do not share one rate-limit bucket. It is
   * a random string used only for this: no login, no profile, no tracking.
   */
  const existingVisitor = readVisitorId(request);
  const visitorId = existingVisitor ?? newVisitorId();
  const issueCookie = existingVisitor === undefined;

  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  // Only the API is rate limited; pages stay freely reachable, including for
  // someone on a shared mobile IP.
  if (pathname.startsWith("/api/")) {
    const result = rateLimitRequest(request, pathname);

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: "You have done that a lot just now. Please wait a moment and try again.",
          retryAfter: result.retryAfter,
        },
        { status: 429, headers: requestHeaders as unknown as HeadersInit },
      );
      response.headers.set("Retry-After", String(result.retryAfter));
      response.headers.set("X-RateLimit-Limit", String(result.limit));
      response.headers.set("X-RateLimit-Remaining", "0");
      const denied = securityHeaders(response, isProduction, csp);
      if (issueCookie) setVisitorCookie(denied, visitorId, isProduction);
      return denied;
    }

    const response = next();
    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    const secured = securityHeaders(response, isProduction, csp);
    if (issueCookie) setVisitorCookie(secured, visitorId, isProduction);
    return secured;
  }

  const secured = securityHeaders(next(), isProduction, csp);
  if (issueCookie) setVisitorCookie(secured, visitorId, isProduction);
  return secured;
}

export const config = {
  // Everything except Next internals and truly static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
