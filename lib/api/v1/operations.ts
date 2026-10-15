import { z } from "zod";
import { isDashScopeConfigured } from "@/lib/ai/client";
import { issueDeviceToken } from "@/lib/platform/auth/tokens";
import { getPowState, issueChallenge, verifySolution } from "@/lib/platform/auth/pow";
import { getConfig } from "@/lib/platform/config";
import { ApiError } from "@/lib/platform/errors";
import { metrics } from "@/lib/platform/metrics";
import { defineOperation, reply, type CachePolicy, type Operation } from "@/lib/platform/route";
import { checkAge } from "@/lib/opportunities/age";
import { clockNow } from "@/lib/opportunities/clock";
import { todayInPakistan } from "@/lib/opportunities/dates";
import { searchResources } from "@/lib/opportunities/directory";
import { flagshipStatus, getFlagship, searchFlagships, summarizeFlagship } from "@/lib/opportunities/flagships";
import { getGuide, listGuides, searchGuides, pickText, summarizeGuide } from "@/lib/opportunities/guides";
import { rankMatches } from "@/lib/opportunities/match";
import { analyzeOffer } from "@/lib/opportunities/scam";
import { getResources } from "@/lib/opportunities/directory";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { bundledSnapshot } from "@/lib/opportunities/bundled";
import { SNAPSHOT_PATH, readSnapshotFile, writeSnapshotFile } from "@/lib/opportunities/snapshot";
import {
  dataStamp,
  getOpportunitiesByIds,
  getOpportunity,
  getStatus,
  listLive,
  loadSnapshotIntoDb,
  prepareOpportunities,
  relatedOpportunities,
  searchOpportunities,
} from "@/lib/opportunities/store";
import type { OpportunityQuery } from "@/lib/opportunities/types";
import type { Language } from "@/lib/types";
import { dataVersionOf, decodeCursor, encodeCursor, fingerprintOf, revisionOf, toOpportunityV1 } from "./mappers";
import * as S from "./schemas";

/**
 * Every v1 operation. Each is declared once (who may call, how fast, what it accepts, what it returns) and the
 * platform supplies the security, validation, caching and observability. Route files in app/api/v1 only re-export
 * `handle` / `preflight`; the OpenAPI document is generated from this list.
 */

export const API_VERSION = "1";
/** Oldest Android build the server still supports; the app shows an "update required" screen below it. */
export const MIN_ANDROID_VERSION = "1.0.0";

const PUBLIC_SHORT: CachePolicy = { kind: "public", maxAge: 60, sMaxAge: 300, swr: 600 };
const PUBLIC_LONG: CachePolicy = { kind: "public", maxAge: 300, sMaxAge: 3600, swr: 86_400 };

const now = () => clockNow();
const language = (value: Language | undefined): Language => value ?? "en";

async function stamp() {
  await prepareOpportunities();
  const current = dataStamp(now());
  return { generatedAt: current.generatedAt ?? null, dataVersion: dataVersionOf(current), live: current.live };
}

const meta = (current: { generatedAt: string | null; dataVersion: string }) => ({ generatedAt: current.generatedAt, dataVersion: current.dataVersion });

// ─── Service ──────────────────────────────────────────────────────────────────

export const health = defineOperation({
  id: "getHealth",
  method: "GET",
  path: "/api/v1/health",
  summary: "Liveness probe",
  description: "Answers as long as the process is up. Does not touch the database; use `/ready` for dependency health.",
  tags: ["Service"],
  auth: "none",
  rate: "health",
  cors: "public",
  responses: { 200: { description: "The service is running.", schema: S.healthResponse } },
  handler: ({ nowMs }) => ({ status: "ok" as const, time: new Date(nowMs).toISOString() }),
});

export const ready = defineOperation({
  id: "getReady",
  method: "GET",
  path: "/api/v1/ready",
  summary: "Readiness probe",
  description: "Checks the database and that listings are loaded. 503 means: do not send traffic here yet.",
  tags: ["Service"],
  auth: "none",
  rate: "health",
  cors: "public",
  responses: { 200: { description: "Ready to serve.", schema: S.readyResponse } },
  errors: ["unavailable"],
  handler: async () => {
    try {
      await prepareOpportunities();
      const status = getStatus(now());
      if (status.total === 0) throw new Error("no listings loaded");
      return { status: "ready" as const, checks: { database: "ok" as const, data: status.stale ? ("stale" as const) : ("fresh" as const), items: status.total } };
    } catch (error) {
      throw new ApiError("unavailable", "The service is not ready.", { cause: error });
    }
  },
});

export const getMeta = defineOperation({
  id: "getMeta",
  method: "GET",
  path: "/api/v1/meta",
  summary: "API and data metadata",
  description: "Version, the minimum supported Android build (for the in-app update gate), feature flags and data freshness.",
  tags: ["Service"],
  auth: "none",
  rate: "health",
  cors: "public",
  cache: { kind: "public", maxAge: 30, sMaxAge: 60, swr: 300 },
  responses: { 200: { description: "Service metadata.", schema: S.metaResponse } },
  handler: async ({ nowMs }) => {
    const current = await stamp();
    const status = getStatus(now());
    return {
      api: { version: API_VERSION as "1", build: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev", minimumClient: { android: MIN_ANDROID_VERSION }, deprecated: [] as string[] },
      server: { time: new Date(nowMs).toISOString() },
      data: { generatedAt: current.generatedAt, total: status.total, ageHours: status.ageHours === null ? null : Math.round(status.ageHours * 10) / 10, stale: status.stale, dataVersion: current.dataVersion },
      features: { deviceAuth: getConfig().tokenSecrets.length > 0, assistant: isDashScopeConfigured() },
    };
  },
});

// ─── Opportunities ────────────────────────────────────────────────────────────

export const listOpportunities = defineOperation({
  id: "listOpportunities",
  method: "GET",
  path: "/api/v1/opportunities",
  summary: "Search and browse opportunities",
  description:
    "Scholarships, jobs, internships, competitions, courses and more. `q` accepts natural language in English, Roman Urdu or Urdu " +
    "(\"fully funded masters in germany\"); explicit filters win over anything inferred. Results are paginated with an opaque `cursor`.",
  tags: ["Opportunities"],
  auth: "optional",
  rate: "search",
  cors: "public",
  cache: PUBLIC_SHORT,
  query: S.listQuery,
  responses: { 200: { description: "A page of matching opportunities.", schema: S.listResponse } },
  errors: ["invalid_parameter", "unknown_parameter", "invalid_cursor", "rate_limited"],
  handler: async ({ query }) => {
    const current = await stamp();
    const limit = query.limit ?? 24;
    const filters: OpportunityQuery = {
      q: query.q,
      kinds: query.kind,
      scope: query.scope,
      country: query.country,
      level: query.level,
      funding: query.funding,
      openToPakistan: query.pk,
      remote: query.remote,
      deadlineWithinDays: query.within,
      newWithinDays: query.new,
      includeClosed: query.closed,
      sort: query.sort,
    };
    const fingerprint = fingerprintOf({ ...filters, dataVersion: undefined });
    const offset = query.cursor ? decodeCursor(query.cursor, fingerprint) : 0;
    const result = searchOpportunities({ ...filters, limit, offset }, now());
    const next = offset + limit;
    return {
      data: result.items.map(toOpportunityV1),
      page: { total: result.total, limit, nextCursor: next < result.total ? encodeCursor(next, fingerprint) : null },
      interpreted: result.interpreted,
      facets: query.include?.includes("facets") ? result.facets : undefined,
      meta: meta(current),
    };
  },
});

export const getOpportunityById = defineOperation({
  id: "getOpportunity",
  method: "GET",
  path: "/api/v1/opportunities/{id}",
  summary: "One opportunity, with related listings",
  tags: ["Opportunities"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_SHORT,
  params: S.idParams,
  query: z.object({}).strict(),
  responses: { 200: { description: "The opportunity.", schema: S.detailResponse } },
  errors: ["invalid_parameter", "not_found"],
  handler: async ({ params }) => {
    const current = await stamp();
    const item = getOpportunity(params.id, now());
    if (!item) throw new ApiError("not_found", "No live opportunity has that id; it may have closed.");
    return { data: toOpportunityV1(item), related: relatedOpportunities(item, 4, now()).map(toOpportunityV1), meta: meta(current) };
  },
});

let manifestCache: { version: string; body: z.infer<typeof S.manifestResponse> } | undefined;

export const opportunityManifest = defineOperation({
  id: "getOpportunityManifest",
  method: "GET",
  path: "/api/v1/opportunities/manifest",
  summary: "Sync manifest: every live id with its content revision",
  description:
    "Step one of delta sync. The client compares `rev` values with what it has stored, fetches only the missing or changed ids with " +
    "`/opportunities/batch`, and deletes local ids that are no longer listed. Revisions change only when a listing's content changes, so an " +
    "unchanged data set costs one conditional request (`If-None-Match` -> 304).",
  tags: ["Sync"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_SHORT,
  query: z.object({}).strict(),
  responses: { 200: { description: "The manifest.", schema: S.manifestResponse } },
  handler: async () => {
    const current = await stamp();
    if (manifestCache?.version === current.dataVersion) return manifestCache.body;
    const data = listLive(now()).map((item) => ({ id: item.id, rev: revisionOf(item) }));
    const body = { data, meta: { ...meta(current), count: data.length } };
    manifestCache = { version: current.dataVersion, body };
    return body;
  },
});

export const opportunityBatch = defineOperation({
  id: "getOpportunityBatch",
  method: "GET",
  path: "/api/v1/opportunities/batch",
  summary: "Fetch several opportunities by id (step two of delta sync)",
  description: `At most ${S.BATCH_MAX} ids per request. Ids that no longer exist are listed in \`missing\`.`,
  tags: ["Sync"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_SHORT,
  query: S.batchQuery,
  responses: { 200: { description: "The requested opportunities.", schema: S.batchResponse } },
  errors: ["invalid_parameter", "unknown_parameter"],
  handler: async ({ query }) => {
    const current = await stamp();
    const ids = [...new Set(query.ids.split(",").filter(Boolean))];
    if (ids.length === 0 || ids.length > S.BATCH_MAX) throw new ApiError("invalid_parameter", `Send between 1 and ${S.BATCH_MAX} ids.`);
    const bad = ids.find((id) => !S.OPPORTUNITY_ID.test(id));
    if (bad !== undefined) throw new ApiError("invalid_parameter", "An id is malformed.", { errors: [{ path: "ids", code: "invalid_id", message: "Ids look like `source-1a2b3c4d5e`." }] });
    const found = getOpportunitiesByIds(ids, now());
    const foundIds = new Set(found.map((item) => item.id));
    return { data: found.map(toOpportunityV1), missing: ids.filter((id) => !foundIds.has(id)), meta: meta(current) };
  },
});

// ─── Programmes, guides, resources ───────────────────────────────────────────

export const listProgrammes = defineOperation({
  id: "listProgrammes",
  method: "GET",
  path: "/api/v1/programmes",
  summary: "Flagship programmes with their current phase (the yearly planner)",
  description:
    "Each programme says whether it is open, closing soon, usually open or off-season today, and when to start preparing. Dates carry a " +
    "`confidence` (`official` or `reported`) and the day they were checked. RAAHI never states fees, stipends or quotas here.",
  tags: ["Programmes"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_LONG,
  query: S.programmeQuery,
  responses: { 200: { description: "Programmes, most urgent first when no question is asked.", schema: S.programmeListResponse } },
  errors: ["invalid_parameter", "unknown_parameter"],
  handler: ({ query }) => {
    const entries = searchFlagships({ q: query.q, kind: query.kind, level: query.level, funding: query.funding, route: query.route, limit: query.limit ?? 60 }, now());
    return { data: entries.map((entry) => summarizeFlagship(entry, language(query.lang))), today: todayInPakistan(now()) };
  },
});

export const getProgramme = defineOperation({
  id: "getProgramme",
  method: "GET",
  path: "/api/v1/programmes/{id}",
  summary: "One flagship programme",
  tags: ["Programmes"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_LONG,
  params: S.programmeIdParams,
  query: S.langQuery,
  responses: { 200: { description: "The programme.", schema: S.programmeDetailResponse } },
  errors: ["invalid_parameter", "not_found"],
  handler: ({ params, query }) => {
    const flagship = getFlagship(params.id);
    if (!flagship) throw new ApiError("not_found", "No programme has that id.");
    return { data: summarizeFlagship({ flagship, status: flagshipStatus(flagship, now()) }, language(query.lang)) };
  },
});

export const listGuidesOp = defineOperation({
  id: "listGuides",
  method: "GET",
  path: "/api/v1/guides",
  summary: "Step-by-step guides",
  tags: ["Guides"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_LONG,
  query: S.guideQuery,
  responses: { 200: { description: "Guide summaries.", schema: S.guideListResponse } },
  errors: ["invalid_parameter", "unknown_parameter"],
  handler: ({ query }) => {
    const lang = language(query.lang);
    const guides = (query.q ? searchGuides({ q: query.q }) : listGuides()).filter((guide) => !query.category || guide.category === query.category);
    return { data: guides.slice(0, query.limit ?? 50).map((guide) => summarizeGuide(guide, lang)) };
  },
});

export const getGuideOp = defineOperation({
  id: "getGuide",
  method: "GET",
  path: "/api/v1/guides/{id}",
  summary: "One guide in full",
  tags: ["Guides"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_LONG,
  params: S.guideIdParams,
  query: S.langQuery,
  responses: { 200: { description: "The guide.", schema: S.guideDetailResponse } },
  errors: ["invalid_parameter", "not_found"],
  handler: ({ params, query }) => {
    const guide = getGuide(params.id);
    if (!guide) throw new ApiError("not_found", "No guide has that id.");
    const lang = language(query.lang);
    return {
      data: {
        ...summarizeGuide(guide, lang),
        audience: pickText(lang, guide.audience),
        steps: guide.steps.map((step) => ({ title: pickText(lang, step.title), body: pickText(lang, step.body), when: step.when ? pickText(lang, step.when) : undefined, resourceIds: step.resourceIds ?? [] })),
        checklist: guide.checklist.map((item) => pickText(lang, item)),
        pitfalls: guide.pitfalls.map((item) => pickText(lang, item)),
        resources: getResources(guide.resourceIds).map((resource) => ({ id: resource.id, name: lang === "ur" ? (resource.nameUr ?? resource.name) : resource.name, url: resource.url })),
        related: guide.related ?? [],
        tools: guide.tools ?? [],
        sources: guide.sources ?? [],
      },
    };
  },
});

export const listResources = defineOperation({
  id: "listResources",
  method: "GET",
  path: "/api/v1/resources",
  summary: "The curated directory of official and trusted links",
  tags: ["Resources"],
  auth: "optional",
  rate: "read",
  cors: "public",
  cache: PUBLIC_LONG,
  query: S.resourceQuery,
  responses: { 200: { description: "Directory entries.", schema: S.resourceListResponse } },
  errors: ["invalid_parameter", "unknown_parameter"],
  handler: ({ query }) => {
    const lang = language(query.lang);
    const result = searchResources({ q: query.q, category: query.category, scope: query.scope, free: query.free, official: query.official });
    return {
      total: result.total,
      data: result.items.slice(0, query.limit ?? 50).map((item) => ({
        id: item.id,
        name: lang === "ur" ? (item.nameUr ?? item.name) : item.name,
        description: lang === "ur" ? (item.descriptionUr ?? item.description) : item.description,
        url: item.url,
        category: item.category,
        scope: item.scope,
        authority: item.authority,
        tags: item.tags,
        free: item.free,
        checked: item.checked,
        note: lang === "ur" ? (item.noteUr ?? item.note) : item.note,
        linkStatus: item.health?.verdict,
      })),
    };
  },
});

// ─── Tools (credential required: they cost CPU, and messages may contain personal details) ───────

export const scamCheck = defineOperation({
  id: "checkOffer",
  method: "POST",
  path: "/api/v1/tools/scam-check",
  summary: "Check an offer for scam red flags",
  description:
    "Analyses pasted offer text and/or checklist answers entirely in memory. The text is never stored or logged - messages from agents often contain " +
    "phone numbers and CNIC details.",
  tags: ["Tools"],
  auth: "required",
  scope: "tools",
  rate: "tools",
  cors: "restricted",
  bodyLimit: 32 * 1024,
  body: S.scamRequest,
  responses: { 200: { description: "Risk score, signals and advice.", schema: S.scamResponse } },
  errors: ["unauthorized", "forbidden", "validation_failed", "payload_too_large", "unsupported_media_type", "invalid_json"],
  handler: ({ body }) => {
    const hasAnswers = body.answers !== undefined && Object.values(body.answers).some(Boolean);
    if (!body.text?.trim() && !hasAnswers) {
      throw new ApiError("validation_failed", "Provide the offer text or tick at least one checklist answer.", { errors: [{ path: "", code: "missing_input", message: "`text` or `answers` is required." }] });
    }
    return { data: analyzeOffer({ text: body.text, answers: body.answers }) };
  },
});

export const ageCheck = defineOperation({
  id: "checkAge",
  method: "POST",
  path: "/api/v1/tools/age-check",
  summary: "Age-limit arithmetic for a job advertisement",
  description: "Both readings of \"not exceeding N years\" (completed years, and to the day) with the last day each still holds. Pure date arithmetic; nothing is stored.",
  tags: ["Tools"],
  auth: "required",
  scope: "tools",
  rate: "tools",
  cors: "restricted",
  body: S.ageRequest,
  responses: { 200: { description: "The age and, if a limit was given, whether it is met.", schema: S.ageResponse } },
  errors: ["unauthorized", "forbidden", "validation_failed"],
  handler: ({ body }) => {
    const result = checkAge(body);
    if (!result) throw new ApiError("validation_failed", "`dob` must be a real date that is not after `asOn`.", { errors: [{ path: "dob", code: "invalid_date", message: "Not a valid date of birth for this reference date." }] });
    return { data: result };
  },
});

export const matchOpportunities = defineOperation({
  id: "matchOpportunities",
  method: "POST",
  path: "/api/v1/tools/match",
  summary: "Rank opportunities for a short profile, with the reasons",
  description: "Transparent rules, no black box; each result says why it was picked and what to double-check. Nothing is stored.",
  tags: ["Tools"],
  auth: "required",
  scope: "tools",
  rate: "tools",
  cors: "restricted",
  body: S.matchRequest,
  responses: { 200: { description: "Ranked matches.", schema: S.matchResponse } },
  errors: ["unauthorized", "forbidden", "validation_failed"],
  handler: async ({ body }) => {
    const current = await stamp();
    const { limit, ...profile } = body;
    const candidates = searchOpportunities({ kinds: profile.interests && profile.interests.length > 0 ? profile.interests : undefined, scope: profile.scope, openToPakistan: true, limit: 100 }, now()).items;
    const results = rankMatches(profile, candidates, limit ?? 12);
    return { data: results.map((entry) => ({ item: toOpportunityV1(entry.item), score: entry.score, reasons: entry.reasons, warnings: entry.warnings })), meta: meta(current) };
  },
});

// ─── Device registration (proof of work) ─────────────────────────────────────

export const authChallenge = defineOperation({
  id: "getAuthChallenge",
  method: "GET",
  path: "/api/v1/auth/challenge",
  summary: "Get a proof-of-work challenge",
  description: "Step one of anonymous device registration. Find a nonce so that SHA-256(`<salt>:<nonce>`) has `difficulty` leading zero bits; see docs/api/authentication.md.",
  tags: ["Authentication"],
  auth: "none",
  rate: "auth",
  cors: "public",
  responses: { 200: { description: "A signed, expiring challenge.", schema: S.challengeResponse } },
  errors: ["not_configured", "rate_limited"],
  handler: ({ nowMs }) => {
    const config = getConfig();
    const state = getPowState();
    const difficulty = state.difficulty.difficulty(nowMs, config.powBits);
    state.difficulty.record(nowMs);
    return issueChallenge(config, difficulty, Math.floor(nowMs / 1000));
  },
});

export const authDevice = defineOperation({
  id: "registerDevice",
  method: "POST",
  path: "/api/v1/auth/device",
  summary: "Exchange a solved challenge for a short-lived access token",
  description: "The token identifies an app install (a random id the app generated), never a person. It expires; register again when it does.",
  tags: ["Authentication"],
  auth: "none",
  rate: "auth",
  cors: "public",
  body: S.deviceRequest,
  responses: { 200: { description: "An access token.", schema: S.deviceResponse } },
  errors: ["challenge_invalid", "validation_failed", "not_configured", "rate_limited"],
  handler: async ({ body, nowMs }) => {
    const config = getConfig();
    const nowSeconds = Math.floor(nowMs / 1000);
    const solved = verifySolution(config, { challenge: body.challenge, nonce: body.nonce }, nowSeconds);
    if (!getPowState().replay.claim(solved.sig, solved.e, nowSeconds)) throw new ApiError("challenge_invalid", "This challenge has already been used.");
    const issued = await issueDeviceToken(config, { installId: body.installId.toLowerCase(), platform: body.platform }, nowSeconds);
    return { accessToken: issued.token, tokenType: issued.tokenType, expiresIn: issued.expiresIn, scope: issued.scope };
  },
});

// ─── Operations (admin) ───────────────────────────────────────────────────────

export const adminMetrics = defineOperation({
  id: "getMetrics",
  method: "GET",
  path: "/api/v1/metrics",
  summary: "Prometheus metrics",
  description: "Per-process counters and latency histograms in the Prometheus text format. Administrator credential required.",
  tags: ["Operations"],
  auth: "admin",
  rate: "admin",
  cors: "restricted",
  responses: { 200: { description: "Prometheus text exposition.", contentType: "text/plain; version=0.0.4; charset=utf-8" } },
  errors: ["unauthorized", "forbidden"],
  handler: () => reply(metrics.expose(), { contentType: "text/plain; version=0.0.4; charset=utf-8" }),
});

export const adminRefresh = defineOperation({
  id: "refreshOpportunities",
  method: "POST",
  path: "/api/v1/admin/refresh",
  summary: "Re-run the scrapers now",
  description: "Normally the scheduled GitHub Action refreshes the data. This is for self-hosted deployments. Administrator credential required.",
  tags: ["Operations"],
  auth: "admin",
  rate: "admin",
  cors: "restricted",
  query: S.refreshQuery,
  responses: { 200: { description: "What was refreshed.", schema: S.refreshResponse } },
  errors: ["unauthorized", "forbidden"],
  handler: async ({ query }) => {
    const previousFile = readSnapshotFile();
    const previous = previousFile.items.length > 0 ? previousFile : bundledSnapshot();
    const snapshot = await runScrapers({ previous, force: query.force === true });
    loadSnapshotIntoDb(snapshot);
    let persisted = false;
    try {
      writeSnapshotFile(snapshot, SNAPSHOT_PATH);
      persisted = true;
    } catch {
      // Read-only filesystem (serverless): the in-process database is updated, the file is not.
    }
    manifestCache = undefined;
    return {
      generatedAt: snapshot.generatedAt,
      items: snapshot.items.length,
      persisted,
      sources: snapshot.sources.map((source) => ({ id: source.sourceId, status: source.status, items: source.items, error: source.error })),
    };
  },
});

/** The registry: OpenAPI generation, the route-file consistency test and the contract tests iterate this. */
export const OPERATIONS: readonly Operation[] = [
  health,
  ready,
  getMeta,
  listOpportunities,
  opportunityManifest,
  opportunityBatch,
  getOpportunityById,
  listProgrammes,
  getProgramme,
  listGuidesOp,
  getGuideOp,
  listResources,
  scamCheck,
  ageCheck,
  matchOpportunities,
  authChallenge,
  authDevice,
  adminMetrics,
  adminRefresh,
];
