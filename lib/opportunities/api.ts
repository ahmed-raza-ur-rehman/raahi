import { FUNDING_TYPES, LEVELS, OPPORTUNITY_KINDS, SCOPES, type Funding, type Level, type OpportunityKind, type OpportunityQuery, type Scope } from "./types";

/**
 * Shared helpers for the public opportunity APIs. The feeds are read-only public data, so GET endpoints
 * send permissive CORS headers: RAAHI's sibling apps (NeuroPrep, MDCAT PrepMaster, Cognitive Fitness) and
 * anyone else can embed the latest listings. Responses are CDN-cacheable for a few minutes.
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

const CACHEABLE = "public, s-maxage=300, stale-while-revalidate=600";

export function jsonResponse(data: unknown, init: { status?: number; cache?: boolean; cors?: boolean; headers?: Record<string, string> } = {}): Response {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.cors === false ? {} : CORS_HEADERS),
      ...(init.cache ? { "Cache-Control": CACHEABLE } : { "Cache-Control": "no-store" }),
      ...init.headers,
    },
  });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, { status });
}

const oneOf = <T extends string>(allowed: readonly T[], value: string | null): T | undefined =>
  value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const positiveInt = (value: string | null, max: number): number | undefined => {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, max) : undefined;
};

const flag = (value: string | null): boolean | undefined => {
  if (value === null) return undefined;
  if (["1", "true", "yes", "on"].includes(value.toLowerCase())) return true;
  if (["0", "false", "no", "off"].includes(value.toLowerCase())) return false;
  return undefined;
};

/** Parse `?q=&kind=job,scholarship&scope=&country=&level=&funding=&pk=1&remote=1&within=14&new=3&source=&tag=&lang=&closed=1&sort=&limit=&offset=`. */
export function parseOpportunityQuery(params: URLSearchParams): OpportunityQuery {
  const kinds = [...params.getAll("kind"), ...params.getAll("kinds")]
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter((value): value is OpportunityKind => (OPPORTUNITY_KINDS as readonly string[]).includes(value));
  const sort = params.get("sort");
  return {
    q: params.get("q")?.slice(0, 200) || undefined,
    kinds: kinds.length > 0 ? [...new Set(kinds)] : undefined,
    scope: oneOf<Scope>(SCOPES, params.get("scope")),
    country: params.get("country")?.slice(0, 80) || undefined,
    level: oneOf<Level>(LEVELS, params.get("level")),
    funding: oneOf<Funding>(FUNDING_TYPES, params.get("funding")),
    openToPakistan: flag(params.get("pk")),
    remote: flag(params.get("remote")),
    deadlineWithinDays: positiveInt(params.get("within"), 365),
    newWithinDays: positiveInt(params.get("new"), 90),
    sourceId: params.get("source")?.slice(0, 60) || undefined,
    tag: params.get("tag")?.slice(0, 40) || undefined,
    language: params.get("lang")?.slice(0, 30) || undefined,
    includeClosed: flag(params.get("closed")),
    sort: sort === "newest" || sort === "deadline" || sort === "relevance" ? sort : undefined,
    limit: positiveInt(params.get("limit"), 100),
    offset: positiveInt(params.get("offset"), 10_000),
  };
}
