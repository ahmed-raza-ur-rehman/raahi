import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/platform/config";
import { buildPageCsp, pageSecurityHeaders } from "@/lib/platform/net/headers";

/**
 * Page-level security (Next.js 16 "proxy", formerly middleware): a fresh nonce and Content-Security-Policy per HTML
 * request, plus the static security headers. Everything here is stateless - the proxy cannot share memory with route
 * handlers, so rate limiting, authentication and cross-site write checks live in the API layer (lib/platform).
 *
 * Because a nonce is per request, pages are rendered per request (see `connection()` in app/layout.tsx). Scripts then
 * run only if they carry the nonce: an injected `<script>` or inline handler is blocked by the browser.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const policy = buildPageCsp(nonce, { dev: process.env.NODE_ENV === "development" });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  for (const [key, value] of Object.entries(pageSecurityHeaders(getConfig()))) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the API (own headers), build output, the embeddable widget, or files with an extension.
      source: "/((?!api|_next/static|_next/image|embed|.*\\..*).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
