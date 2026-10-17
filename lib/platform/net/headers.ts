import type { PlatformConfig } from "../config";

/**
 * Security response headers.
 *
 * API responses are JSON, so the CSP is the OWASP-recommended "nothing may load or frame this" policy. Page
 * responses get a nonce-based CSP built per request (see `buildPageCsp` and proxy.ts) plus the static set below.
 */

export function apiSecurityHeaders(config: Pick<PlatformConfig, "env">): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=()",
  };
  if (config.env === "production") headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  return headers;
}

/** Headers for HTML pages that do not depend on the request (the CSP is added per request by the proxy). */
export function pageSecurityHeaders(config: Pick<PlatformConfig, "env">): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Cross-Origin-Opener-Policy": "same-origin",
    // Microphone is used by the voice input on the chat page, so it stays allowed for this origin only.
    "Permissions-Policy": "geolocation=(), camera=(), microphone=(self), payment=(), usb=()",
  };
  if (config.env === "production") headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  return headers;
}

/**
 * Content-Security-Policy for HTML pages.
 *  - scripts: same-origin files plus the per-request nonce ('strict-dynamic' lets nonce'd scripts load their chunks);
 *    no 'unsafe-inline'. Development additionally needs 'unsafe-eval' for React's debugging features.
 *  - styles: same-origin sheets and nonce'd <style>; inline style *attributes* are allowed (they cannot run script
 *    and the UI uses a few computed widths), but injected <style> elements without the nonce are blocked.
 *  - nothing may frame the site, change the base URI, submit forms elsewhere or load plugins.
 */
export function buildPageCsp(nonce: string, options: { dev: boolean }): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    options.dev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (!options.dev) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
