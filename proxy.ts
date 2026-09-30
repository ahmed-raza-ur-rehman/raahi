import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { budgetFor, clientKey, rateLimit } from "@/lib/security/rate-limit";

/**
 * Security headers on every response.
 *
 * The app handles real citizen data (CNICs, phone numbers, medical need), so
 * the baseline hardening belongs in one place rather than per-route.
 */
function securityHeaders(response: NextResponse, isProduction: boolean): NextResponse {
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

  /**
   * Content-Security-Policy.
   *
   * `script-src` allows 'unsafe-inline' because Next.js injects bootstrap
   * scripts; moving to per-request nonces is the proper fix and is tracked as
   * a follow-up. Even with that concession this blocks the attacks that matter
   * most here: injected third-party scripts, `data:` script URLs, framing and
   * `<base>` hijacking. Object sources are locked to none.
   */
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'" + (isProduction ? "" : " 'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Photos are captured to object URLs / data URLs by the document scanner.
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);

  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === "production";

  // Only the API is rate limited; pages stay freely reachable, including for
  // someone on a shared mobile IP.
  if (pathname.startsWith("/api/")) {
    const budget = budgetFor(pathname);
    const result = rateLimit(`${clientKey(request)}:${pathname}`, budget.limit, budget.windowMs);

    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: "You have done that a lot just now. Please wait a moment and try again.",
          retryAfter: result.retryAfter,
        },
        { status: 429 },
      );
      response.headers.set("Retry-After", String(result.retryAfter));
      response.headers.set("X-RateLimit-Limit", String(result.limit));
      response.headers.set("X-RateLimit-Remaining", "0");
      return securityHeaders(response, isProduction);
    }

    const response = NextResponse.next();
    response.headers.set("X-RateLimit-Limit", String(result.limit));
    response.headers.set("X-RateLimit-Remaining", String(result.remaining));
    return securityHeaders(response, isProduction);
  }

  return securityHeaders(NextResponse.next(), isProduction);
}

export const config = {
  // Everything except Next internals and truly static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/).*)"],
};
