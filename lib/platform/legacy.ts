import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { secretsMatch } from "./auth/api-keys";
import { nowMs } from "./clock";
import { getConfig, type PlatformConfig } from "./config";
import { ApiError } from "./errors";
import { requestIdFrom } from "./ids";
import { checkRateLimit, rateLimitHeaders, type PolicyName } from "./limit/limiter";
import { getLogger } from "./log";
import { metrics } from "./metrics";
import { anonymiseIp, clientIp, ipSalt } from "./net/client-ip";
import { isCrossSiteWrite } from "./net/cors";
import { apiSecurityHeaders } from "./net/headers";
import { toProblem } from "./problem";

/**
 * Guard for the original (cookie-session) RAAHI endpoints under /api/*.
 *
 * Those handlers keep their response shapes - the web UI depends on them - but run behind the same protections as the
 * v1 API: request ids, rate limits (per client address AND per session cookie, so one noisy user on a shared carrier
 * address does not starve the rest), cross-site write refusal, a streaming request-size cap, optional admin-only
 * access, opaque 5xx errors and log hygiene. See docs/security/threat-model.md (T-04..T-09).
 */

export interface LegacyLimit {
  policy: PolicyName;
  /** What the budget is shared by: the client address, or the session cookie (falls back to the address). */
  by: "ip" | "session";
}

export interface LegacyOptions {
  /** Operation name for logs and metrics. */
  name: string;
  limits: LegacyLimit[];
  /** Refuse cross-site browser writes. Default: on for every method except GET/HEAD. */
  csrf?: boolean;
  /** Only the operator may call this: needs `Authorization: Bearer <admin secret>`; 404 when no admin secret is set. */
  admin?: boolean;
  /** Reject request bodies larger than this (enforced while streaming). */
  maxBodyBytes?: number;
}

const processSalt = randomBytes(32);
const SESSION_COOKIE = /(?:^|;\s*)raahi_session=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:;|$)/i;

function sessionSubject(request: Request, salt: Uint8Array): string | undefined {
  const match = SESSION_COOKIE.exec(request.headers.get("cookie") ?? "");
  return match ? anonymiseIp(match[1].toLowerCase(), salt) : undefined;
}

/** The origin the browser used to reach us (honours the proxy's forwarded headers only when proxies are trusted). */
export function requestOriginOf(request: Request, config: Pick<PlatformConfig, "trustedProxies">): string {
  const url = new URL(request.url);
  const trusted = config.trustedProxies > 0;
  const host = (trusted && request.headers.get("x-forwarded-host")?.split(",")[0].trim()) || request.headers.get("host") || url.host;
  const proto = (trusted && request.headers.get("x-forwarded-proto")?.split(",")[0].trim()) || url.protocol.replace(":", "");
  return `${proto}://${host}`;
}

/** A body reader that fails once more than `max` bytes have flowed through it. */
export function limitBody(request: Request, max: number): { request: Request; exceeded: () => boolean } {
  const declared = Number(request.headers.get("content-length"));
  let exceeded = Number.isFinite(declared) && declared > max;
  if (exceeded || !request.body) return { request, exceeded: () => exceeded };
  let total = 0;
  const gate = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > max) {
        exceeded = true;
        controller.error(new Error("request body too large"));
        return;
      }
      controller.enqueue(chunk);
    },
  });
  const body = request.body.pipeThrough(gate);
  return { request: new Request(request, { body, duplex: "half" } as RequestInit), exceeded: () => exceeded };
}

type Handler<Context> = (request: Request, context: Context) => Promise<Response> | Response;

export function guardLegacy<Context = unknown>(handler: Handler<Context>, options: LegacyOptions): (request: Request, context?: Context) => Promise<Response> {
  return async (request, context) => {
    const config = getConfig();
    const log = getLogger(config);
    const requestId = requestIdFrom(request.headers);
    const started = performance.now();
    const url = new URL(request.url);
    const salt = ipSalt(config.tokenSecrets[0]?.key, processSalt);
    const clientKey = anonymiseIp(clientIp(request.headers, config.trustedProxies), salt);
    const write = !["GET", "HEAD", "OPTIONS"].includes(request.method);
    let response: Response;

    try {
      if (options.admin) {
        if (!config.adminSecret) throw new ApiError("not_found");
        const presented = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization")?.trim() ?? "")?.[1];
        if (!presented || !secretsMatch(presented, config.adminSecret)) {
          metrics.authFailures.inc({ reason: "admin" });
          const guard = await checkRateLimit({ policy: "authfail", tier: "anonymous", subject: clientKey, scale: config.rateLimitScale, nowMs: nowMs() });
          if (!guard.allowed) throw new ApiError("rate_limited", "Too many failed attempts.", { headers: rateLimitHeaders(guard) });
          throw new ApiError("unauthorized", "Administrator credentials are required.", { headers: { "WWW-Authenticate": 'Bearer realm="raahi"' } });
        }
      }

      if (write && options.csrf !== false && isCrossSiteWrite(request.headers, requestOriginOf(request, config), config)) throw new ApiError("origin_not_allowed");

      const session = sessionSubject(request, salt);
      for (const limit of options.limits) {
        const subject = limit.by === "session" && session ? `session:${session}` : `ip:${clientKey}`;
        const decision = await checkRateLimit({ policy: limit.policy, tier: "anonymous", subject, scale: config.rateLimitScale, nowMs: nowMs() });
        if (!decision.allowed) {
          metrics.rateLimited.inc({ policy: limit.policy, tier: "anonymous" });
          throw new ApiError("rate_limited", "Too many requests. Please wait a moment and try again.", { headers: rateLimitHeaders(decision) });
        }
      }

      const capped = options.maxBodyBytes && write ? limitBody(request, options.maxBodyBytes) : undefined;
      if (capped?.exceeded()) throw new ApiError("payload_too_large", "That request is too large.");
      response = await handler(capped?.request ?? request, context as Context);
      if (capped?.exceeded()) throw new ApiError("payload_too_large", "That request is too large.");
    } catch (error) {
      const { problem, headers } = toProblem(error, { requestId, instance: url.pathname });
      if (problem.status >= 500) log.error("legacy request failed", { requestId, op: options.name, error });
      response = new Response(JSON.stringify({ error: problem.detail ?? problem.title, code: problem.code, requestId }), {
        status: problem.status,
        headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
      });
    }

    for (const [key, value] of Object.entries(apiSecurityHeaders(config))) if (!response.headers.has(key)) response.headers.set(key, value);
    // Personal, cookie-scoped data must never be stored by a shared cache.
    if (!response.headers.has("Cache-Control")) response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-Id", requestId);

    const seconds = (performance.now() - started) / 1000;
    metrics.httpRequests.inc({ operation: options.name, method: request.method, status: `${Math.floor(response.status / 100)}xx` });
    metrics.httpDuration.observe(seconds, { operation: options.name });
    log[response.status >= 500 ? "error" : response.status === 401 || response.status === 403 || response.status === 429 ? "warn" : "info"]("request", {
      requestId,
      op: options.name,
      method: request.method,
      path: url.pathname.slice(0, 120),
      status: response.status,
      ms: Math.round(seconds * 1000),
      subject: clientKey,
    });
    return response;
  };
}
