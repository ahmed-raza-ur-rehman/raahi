import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import type { z } from "zod";
import { authenticate } from "./auth/authenticate";
import { hasScope, type Principal } from "./auth/principal";
import { nowMs as platformNow } from "./clock";
import { getConfig, type ApiScope, type PlatformConfig } from "./config";
import { ApiError, type ErrorCode } from "./errors";
import { requestIdFrom } from "./ids";
import { RATE_POLICIES, checkRateLimit, rateLimitHeaders, type LimitDecision, type PolicyName, type Tier } from "./limit/limiter";
import { getLogger, type Logger } from "./log";
import { metrics } from "./metrics";
import { readJsonBody } from "./net/body";
import { anonymiseIp, clientIp, ipSalt } from "./net/client-ip";
import { corsHeaders, type CorsMode } from "./net/cors";
import { etagOf, ifNoneMatchHits } from "./net/etag";
import { apiSecurityHeaders } from "./net/headers";
import { parseBody, parsePathParams, parseQuery } from "./net/validate";
import { PROBLEM_CONTENT_TYPE, toProblem } from "./problem";

/**
 * `defineOperation` - the one way a v1 endpoint is written.
 *
 * An operation is a declarative spec (what it is, who may call it, how fast, what it accepts and returns) plus a
 * small handler. The platform runs the same hardened pipeline for every operation:
 *
 *   request id -> authenticate -> authorise -> rate-limit -> validate params/query/body -> handler
 *   -> verify the response against its declared schema -> cache headers + ETag -> security headers + CORS
 *   -> structured log + metrics. Any failure becomes an RFC 9457 problem document.
 *
 * The same spec feeds the OpenAPI generator (lib/platform/openapi.ts), so the documentation, the validation and the
 * runtime behaviour cannot drift apart - a contract test enforces it.
 */

export type HttpMethod = "GET" | "POST";
export type AuthMode = "none" | "optional" | "required" | "admin";

export type CachePolicy = { kind: "none" } | { kind: "public"; maxAge: number; sMaxAge: number; swr: number };

export interface ResponseSpec {
  description: string;
  schema?: z.ZodType;
  /** Defaults to application/json. */
  contentType?: string;
  example?: unknown;
}

type Schema = z.ZodType;
type Infer<S> = S extends z.ZodType ? z.output<S> : undefined;

export interface HandlerContext<P, Q, B> {
  request: Request;
  params: P;
  query: Q;
  body: B;
  principal: Principal;
  requestId: string;
  /** Hashed client address (the rate-limit subject). Raw addresses never reach handlers or logs. */
  clientKey: string;
  nowMs: number;
  log: Logger;
}

/** Return this to set a status or headers; return a plain value for `200 OK`. */
export class Reply {
  constructor(
    readonly body: unknown,
    readonly init: { status?: number; headers?: Record<string, string>; contentType?: string } = {},
  ) {}
}
export const reply = (body: unknown, init?: Reply["init"]) => new Reply(body, init);

export interface OperationSpec<PS extends Schema | undefined, QS extends Schema | undefined, BS extends Schema | undefined> {
  /** Unique, stable `operationId` (also the metrics label). */
  id: string;
  method: HttpMethod;
  /** OpenAPI path template, e.g. `/api/v1/opportunities/{id}`. */
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  auth: AuthMode;
  /** Scope the credential must carry (default `read`); ignored for `none` and `admin`. */
  scope?: ApiScope;
  rate: PolicyName;
  cors: CorsMode;
  cache?: CachePolicy;
  /** Maximum request body in bytes (default 16 KiB). */
  bodyLimit?: number;
  params?: PS;
  query?: QS;
  body?: BS;
  responses: Record<number, ResponseSpec>;
  /** Error codes this operation can return, for the documentation. */
  errors?: ErrorCode[];
  handler: (context: HandlerContext<Infer<PS>, Infer<QS>, Infer<BS>>) => unknown | Promise<unknown>;
}

/** The non-generic view of an operation, used by the registry, OpenAPI generator and tests. */
export interface OperationMeta {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags: string[];
  auth: AuthMode;
  scope: ApiScope;
  rate: PolicyName;
  cors: CorsMode;
  cache: CachePolicy;
  bodyLimit: number;
  params?: Schema;
  query?: Schema;
  body?: Schema;
  responses: Record<number, ResponseSpec>;
  errors: ErrorCode[];
}

export type RouteContext = { params?: Promise<Record<string, string | string[] | undefined>> };

export interface Operation {
  meta: OperationMeta;
  /** The `GET` / `POST` export of the route file. */
  handle: (request: Request, context?: RouteContext) => Promise<Response>;
  /** The `OPTIONS` export of the route file (CORS preflight). */
  preflight: (request: Request) => Response;
}

const processSalt = randomBytes(32);
const DEFAULT_BODY_LIMIT = 16 * 1024;

export function defineOperation<PS extends Schema | undefined = undefined, QS extends Schema | undefined = undefined, BS extends Schema | undefined = undefined>(
  spec: OperationSpec<PS, QS, BS>,
): Operation {
  const meta: OperationMeta = {
    id: spec.id,
    method: spec.method,
    path: spec.path,
    summary: spec.summary,
    description: spec.description,
    tags: spec.tags,
    auth: spec.auth,
    scope: spec.scope ?? "read",
    rate: spec.rate,
    cors: spec.cors,
    cache: spec.cache ?? { kind: "none" },
    bodyLimit: spec.bodyLimit ?? DEFAULT_BODY_LIMIT,
    params: spec.params,
    query: spec.query,
    body: spec.body,
    responses: spec.responses,
    errors: spec.errors ?? [],
  };

  const handle = async (request: Request, routeContext?: RouteContext): Promise<Response> => {
    const config = getConfig();
    const log = getLogger(config);
    const requestId = requestIdFrom(request.headers);
    const started = performance.now();
    const url = new URL(request.url);
    const salt = ipSalt(config.tokenSecrets[0]?.key, processSalt);
    const clientKey = anonymiseIp(clientIp(request.headers, config.trustedProxies), salt);

    let principal: Principal = { tier: "anonymous", id: "anonymous" };
    let decision: LimitDecision | undefined;
    let response: Response;

    try {
      const nowMs = platformNow();
      principal = await resolvePrincipal(request, config, meta, nowMs, clientKey);
      decision = await enforceRateLimit(config, meta, principal, clientKey, nowMs);

      const paramsRaw = routeContext?.params ? await routeContext.params : {};
      const params = spec.params ? parsePathParams(spec.params, paramsRaw) : undefined;
      const query = spec.query ? parseQuery(spec.query, url.searchParams) : rejectQuery(url.searchParams);
      const body = spec.body ? parseBody(spec.body, await readJsonBody(request, meta.bodyLimit)) : undefined;

      const output = await spec.handler({
        request,
        params: params as Infer<PS>,
        query: query as Infer<QS>,
        body: body as Infer<BS>,
        principal,
        requestId,
        clientKey,
        nowMs,
        log: log.child({ requestId, op: meta.id }),
      });
      response = successResponse(meta, config, request, output, principal, decision);
    } catch (error) {
      response = problemResponse(error, { requestId, instance: url.pathname, config, log, meta, request, decision });
    }

    return finalise(response, { meta, config, request, requestId, started, principal, clientKey, log, salt, pathname: url.pathname });
  };

  const preflight = (request: Request): Response => {
    const config = getConfig();
    const requestId = requestIdFrom(request.headers);
    const headers = new Headers({
      ...apiSecurityHeaders(config),
      ...corsHeaders(meta.cors, request.headers.get("origin"), config, [meta.method]),
      Allow: `${meta.method}, OPTIONS`,
      "X-Request-Id": requestId,
      "Cache-Control": "public, max-age=600",
    });
    return new Response(null, { status: 204, headers });
  };

  return { meta, handle, preflight };
}

// ─── Pipeline stages ──────────────────────────────────────────────────────────

async function resolvePrincipal(request: Request, config: PlatformConfig, meta: OperationMeta, nowMs: number, clientKey: string): Promise<Principal> {
  if (meta.auth === "none") return { tier: "anonymous", id: "anonymous" };
  let principal: Principal;
  try {
    principal = await authenticate(request, config, Math.floor(nowMs / 1000), { allowAdmin: meta.auth === "admin" });
  } catch (error) {
    // Failed credentials are rate-limited per client so a secret cannot be guessed at wire speed.
    const guard = await checkRateLimit({ policy: "authfail", tier: "anonymous", subject: clientKey, scale: config.rateLimitScale, nowMs });
    if (!guard.allowed) {
      metrics.rateLimited.inc({ policy: "authfail", tier: "anonymous" });
      throw new ApiError("rate_limited", "Too many failed authentication attempts.", { headers: rateLimitHeaders(guard) });
    }
    throw error;
  }

  if (meta.auth === "admin") {
    if (principal.tier === "admin") return principal;
    throw principal.tier === "anonymous" ? new ApiError("unauthorized", "Administrator credentials are required.", { headers: { "WWW-Authenticate": `Bearer realm="raahi"` } }) : new ApiError("forbidden");
  }
  if (meta.auth === "required" && principal.tier === "anonymous") {
    throw new ApiError("unauthorized", "This operation needs an access token or API key.", { headers: { "WWW-Authenticate": `Bearer realm="raahi"` } });
  }
  if (!hasScope(principal, meta.scope)) {
    if (principal.tier === "anonymous") {
      throw new ApiError("unauthorized", "This operation needs an access token or API key.", { headers: { "WWW-Authenticate": `Bearer realm="raahi", scope="${meta.scope}"` } });
    }
    throw new ApiError("forbidden", `The credential does not carry the "${meta.scope}" scope.`);
  }
  return principal;
}

function identityFor(principal: Principal, clientKey: string): { tier: Tier; subject: string; multiplier: number } {
  switch (principal.tier) {
    case "device":
      return { tier: "device", subject: principal.id, multiplier: 4 };
    case "client":
      return { tier: "client", subject: principal.id, multiplier: principal.rpm / RATE_POLICIES.read.rpm };
    case "admin":
      return { tier: "admin", subject: "admin", multiplier: 1 };
    default:
      return { tier: "anonymous", subject: clientKey, multiplier: 1 };
  }
}

async function enforceRateLimit(config: PlatformConfig, meta: OperationMeta, principal: Principal, clientKey: string, nowMs: number): Promise<LimitDecision> {
  const identity = identityFor(principal, clientKey);
  const decision = await checkRateLimit({ policy: meta.rate, ...identity, scale: config.rateLimitScale, nowMs });
  if (!decision.allowed) {
    metrics.rateLimited.inc({ policy: meta.rate, tier: identity.tier });
    throw new ApiError("rate_limited", "Too many requests. Wait for the time in Retry-After, then try again.", { headers: rateLimitHeaders(decision) });
  }
  return decision;
}

function rejectQuery(params: URLSearchParams): undefined {
  for (const key of params.keys()) {
    throw new ApiError("unknown_parameter", `This operation takes no query parameters.`, {
      errors: [{ path: key.replace(/[^\w.[\]-]/g, "_").slice(0, 40), code: "unrecognized_key", message: "This parameter is not accepted." }],
    });
  }
  return undefined;
}

function successResponse(meta: OperationMeta, config: PlatformConfig, request: Request, output: unknown, principal: Principal, decision: LimitDecision): Response {
  const result = output instanceof Reply ? output : new Reply(output);
  const status = result.init.status ?? 200;
  const declared = meta.responses[status];
  const contentType = result.init.contentType ?? declared?.contentType ?? "application/json";
  const isJson = contentType.startsWith("application/json");

  if (config.validateResponses) {
    if (!declared) {
      metrics.contractViolations.inc({ operation: meta.id });
      throw new ApiError("contract_violation", `Operation ${meta.id} returned undeclared status ${status}.`);
    }
    if (declared.schema) {
      const check = declared.schema.safeParse(result.body);
      if (!check.success) {
        metrics.contractViolations.inc({ operation: meta.id });
        throw new ApiError("contract_violation", `Operation ${meta.id} returned a body that does not match its schema.`, { cause: check.error });
      }
    }
  }

  const text = status === 204 || result.body === undefined ? "" : isJson ? JSON.stringify(result.body) : String(result.body);
  const headers = new Headers(result.init.headers);
  headers.set("Content-Type", isJson ? "application/json; charset=utf-8" : contentType);

  const cacheable = meta.method === "GET" && status === 200 && meta.cache.kind === "public";
  if (cacheable && meta.cache.kind === "public") {
    const etag = etagOf(text);
    headers.set("ETag", etag);
    // A credentialed request must not be stored by shared caches; an anonymous one may be.
    headers.set(
      "Cache-Control",
      principal.tier === "anonymous"
        ? `public, max-age=${meta.cache.maxAge}, s-maxage=${meta.cache.sMaxAge}, stale-while-revalidate=${meta.cache.swr}`
        : `private, max-age=${meta.cache.maxAge}`,
    );
    if (ifNoneMatchHits(request.headers.get("if-none-match"), etag)) {
      return new Response(null, { status: 304, headers: stripBodyHeaders(headers) });
    }
  } else {
    headers.set("Cache-Control", "no-store");
  }

  // RateLimit-* describe the caller's budget; replaying them from a shared cache would be wrong, so they are only
  // sent when the response is not shared-cacheable.
  const sharedCacheable = cacheable && principal.tier === "anonymous";
  if (!sharedCacheable) for (const [key, value] of Object.entries(rateLimitHeaders(decision))) headers.set(key, value);

  return new Response(status === 204 ? null : text, { status, headers });
}

function stripBodyHeaders(headers: Headers): Headers {
  headers.delete("Content-Type");
  headers.delete("Content-Length");
  return headers;
}

interface ProblemContext {
  requestId: string;
  instance: string;
  config: PlatformConfig;
  log: Logger;
  meta: OperationMeta;
  request: Request;
  decision?: LimitDecision;
}

function problemResponse(error: unknown, context: ProblemContext): Response {
  const { problem, headers: extra } = toProblem(error, { requestId: context.requestId, instance: context.instance });
  if (problem.status >= 500) {
    context.log.error("request failed", { requestId: context.requestId, op: context.meta.id, code: problem.code, error });
  }
  const headers = new Headers(extra);
  headers.set("Content-Type", PROBLEM_CONTENT_TYPE);
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(problem), { status: problem.status, headers });
}

interface FinaliseContext {
  meta: OperationMeta;
  config: PlatformConfig;
  request: Request;
  requestId: string;
  started: number;
  principal: Principal;
  clientKey: string;
  log: Logger;
  salt: Uint8Array;
  pathname: string;
}

function finalise(response: Response, context: FinaliseContext): Response {
  const { meta, config, request, requestId } = context;
  const headers = response.headers;
  for (const [key, value] of Object.entries({
    ...apiSecurityHeaders(config),
    ...corsHeaders(meta.cors, request.headers.get("origin"), config, [meta.method]),
  })) {
    if (key === "Vary") continue;
    headers.set(key, value);
  }
  const vary = new Set(["Accept-Encoding", ...(meta.auth !== "none" ? ["Authorization"] : []), ...(meta.cors === "restricted" ? ["Origin"] : [])]);
  headers.set("Vary", [...vary].join(", "));
  headers.set("X-Request-Id", requestId);

  const seconds = (performance.now() - context.started) / 1000;
  metrics.httpRequests.inc({ operation: meta.id, method: meta.method, status: `${Math.floor(response.status / 100)}xx` });
  metrics.httpDuration.observe(seconds, { operation: meta.id });

  const level = response.status >= 500 ? "error" : response.status === 401 || response.status === 403 || response.status === 429 ? "warn" : "info";
  context.log[level]("request", {
    requestId,
    op: meta.id,
    method: meta.method,
    path: context.pathname.slice(0, 120),
    status: response.status,
    ms: Math.round(seconds * 1000),
    tier: context.principal.tier,
    subject: context.principal.tier === "anonymous" ? context.clientKey : anonymiseIp(context.principal.id, context.salt),
  });
  return response;
}

