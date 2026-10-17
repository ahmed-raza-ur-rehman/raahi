import { z } from "zod";
import { ERROR_CODES } from "@/lib/platform/errors";
import { FUNDING_TYPES, LEVELS, OPPORTUNITY_KINDS, RESOURCE_CATEGORIES, SCOPES } from "@/lib/opportunities/types";
import { ANSWER_KEYS } from "@/lib/opportunities/scam";

/**
 * The v1 API contract: every request and response shape, as zod schemas.
 *
 * These are the single source of truth. They validate requests at runtime, verify responses in development and
 * test (the contract check in `defineOperation`), generate the OpenAPI document, and define the golden examples
 * the Android client's tests consume. If a schema and the behaviour disagree, a test fails.
 */

// ─── Primitives ───────────────────────────────────────────────────────────────

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const isoInstant = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
export const httpUrl = z.string().regex(/^https?:\/\//).max(2048);
export const OPPORTUNITY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
export const opportunityId = z.string().regex(OPPORTUNITY_ID);
export const languageSchema = z.enum(["en", "ur", "ps"]);

/**
 * Free text from a person: no control characters and no bidirectional override/isolate characters (the
 * "Trojan Source" family), but zero-width (non-)joiners are allowed because Urdu and Persian orthography needs them.
 */
export const SAFE_TEXT = /^[^\p{Cc}\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]*$/u;
export const safeText = (max: number) => z.string().max(max).regex(SAFE_TEXT, "must not contain control or bidirectional-override characters");

// ─── Query-string helpers (every value arrives as a string) ───────────────────

export const intParam = (min: number, max: number) =>
  z.string().regex(/^\d{1,6}$/, "must be a non-negative integer").transform(Number).pipe(z.number().int().min(min).max(max));

export const boolParam = z.enum(["1", "0", "true", "false"]).transform((value) => value === "1" || value === "true");

export function csvParam<const T extends readonly [string, ...string[]]>(values: T, maxItems: number) {
  return z
    .string()
    .max(400)
    .transform((value) => [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))])
    .pipe(z.array(z.enum(values)).min(1).max(maxItems));
}

// ─── Problem details ──────────────────────────────────────────────────────────

export const problemSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: z.enum(ERROR_CODES as [string, ...string[]]),
  detail: z.string().optional(),
  instance: z.string().optional(),
  requestId: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), code: z.string(), message: z.string() })).optional(),
});

// ─── Opportunities ────────────────────────────────────────────────────────────

export const opportunitySchema = z.strictObject({
  id: z.string(),
  /** Content revision: changes only when the listing's content changes (not on every scrape, not as days pass). */
  rev: z.string().regex(/^[a-f0-9]{12}$/),
  kind: z.enum(OPPORTUNITY_KINDS),
  scope: z.enum(SCOPES),
  title: z.string(),
  organization: z.string().optional(),
  summary: z.string().optional(),
  url: httpUrl,
  applyUrl: httpUrl.optional(),
  source: z.strictObject({ id: z.string(), name: z.string(), url: httpUrl }),
  country: z.string().optional(),
  location: z.string().optional(),
  remote: z.boolean().optional(),
  levels: z.array(z.enum(LEVELS)),
  fields: z.array(z.string()),
  tags: z.array(z.string()),
  funding: z.enum(FUNDING_TYPES).optional(),
  deadline: isoDate.optional(),
  deadlineText: z.string().optional(),
  rolling: z.boolean().optional(),
  postedAt: isoInstant.optional(),
  startsAt: isoDate.optional(),
  firstSeen: isoInstant,
  lastSeen: isoInstant,
  openToPakistan: z.boolean().nullable().optional(),
  eligibilityNote: z.string().optional(),
  languages: z.array(z.string()).optional(),
  alsoOn: z.array(z.strictObject({ sourceName: z.string(), url: z.string() })).optional(),
  /** Convenience values computed for "today in Pakistan"; clients that work offline compute them from `deadline`. */
  status: z.enum(["open", "closing-soon", "closed", "rolling", "unknown"]),
  daysLeft: z.number().int().nullable(),
  isNew: z.boolean(),
});
export type OpportunityV1 = z.infer<typeof opportunitySchema>;

export const facetCount = z.object({ value: z.string(), count: z.number().int() });

export const dataMeta = z.object({
  /** When the underlying snapshot was generated; null before the first load. */
  generatedAt: isoInstant.nullable(),
  /** Opaque token that changes whenever the data set changes. */
  dataVersion: z.string(),
});

export const listQuery = z
  .object({
    q: safeText(200).describe("Search words in English, Roman Urdu or Urdu. Understood as natural language: \"fully funded masters in germany\" sets the filters for you; explicit filters below win.").optional(),
    kind: csvParam(OPPORTUNITY_KINDS, OPPORTUNITY_KINDS.length).describe("Comma-separated kinds: scholarship, fellowship, internship, job, competition, course, coupon, training, grant, admission, notice. Notices are regulator alerts and are hidden unless asked for.").optional(),
    scope: z.enum(SCOPES).describe("`pakistan` = located in or aimed at people in Pakistan; `international` = abroad, remote or global.").optional(),
    country: safeText(80).describe("Country name in English, matched case-insensitively.").optional(),
    level: z.enum(LEVELS).describe("Study or career level.").optional(),
    funding: z.enum(FUNDING_TYPES).describe("Funding type.").optional(),
    pk: boolParam.describe("`1` = only items open to applicants from Pakistan (or not stating otherwise).").optional(),
    remote: boolParam.describe("`1` = only remote or online items.").optional(),
    within: intParam(0, 365).describe("Only items whose deadline falls within this many days (items without a deadline are excluded).").optional(),
    new: intParam(0, 90).describe("Only items first seen within this many days.").optional(),
    sort: z.enum(["relevance", "newest", "deadline"]).describe("Order of results. Default `relevance`.").optional(),
    closed: boolParam.describe("`1` = include items whose deadline has passed.").optional(),
    limit: intParam(1, 100).describe("Page size, 1-100 (default 24).").optional(),
    cursor: z.string().regex(/^[A-Za-z0-9_-]{8,200}$/).describe("Opaque cursor from `page.nextCursor`. Valid only with the same filters it was issued for.").optional(),
    include: csvParam(["facets"] as const, 1).describe("Optional extras: `facets` adds counts per kind, scope, country, level, funding and source.").optional(),
  })
  .strict();

export const listResponse = z.object({
  data: z.array(opportunitySchema),
  page: z.object({ total: z.number().int(), limit: z.number().int(), nextCursor: z.string().nullable() }),
  interpreted: z.object({
    terms: z.array(z.string()),
    kinds: z.array(z.enum(OPPORTUNITY_KINDS)).optional(),
    country: z.string().optional(),
    level: z.enum(LEVELS).optional(),
    funding: z.enum(FUNDING_TYPES).optional(),
    scope: z.enum(SCOPES).optional(),
    deadlineWithinDays: z.number().int().optional(),
    remote: z.boolean().optional(),
    corrected: z.object({ from: z.string(), to: z.string(), changes: z.array(z.object({ from: z.string(), to: z.string() })) }).optional(),
  }),
  facets: z
    .object({ kind: z.array(facetCount), scope: z.array(facetCount), country: z.array(facetCount), level: z.array(facetCount), funding: z.array(facetCount), source: z.array(facetCount) })
    .optional(),
  meta: dataMeta,
});

export const idParams = z.object({ id: opportunityId });

export const detailResponse = z.object({ data: opportunitySchema, related: z.array(opportunitySchema), meta: dataMeta });

export const manifestResponse = z.object({
  data: z.array(z.object({ id: z.string(), rev: z.string().regex(/^[a-f0-9]{12}$/) })),
  meta: dataMeta.extend({ count: z.number().int() }),
});

export const batchQuery = z.object({ ids: z.string().max(3500).regex(/^[A-Za-z0-9_,-]+$/, "ids must be a comma-separated list of opportunity ids").describe("Comma-separated opportunity ids, at most 50.") }).strict();
export const BATCH_MAX = 50;
export const batchResponse = z.object({ data: z.array(opportunitySchema), missing: z.array(z.string()), meta: dataMeta });

// ─── Programmes (the yearly planner) ─────────────────────────────────────────

export const programmeSchema = z.strictObject({
  id: z.string(),
  kind: z.enum(OPPORTUNITY_KINDS),
  title: z.string(),
  provider: z.string(),
  where: z.string(),
  levels: z.array(z.enum(LEVELS)),
  funding: z.enum(FUNDING_TYPES),
  summary: z.string(),
  route: z.enum(["direct", "hec", "embassy", "agency", "university"]),
  routeNote: z.string(),
  usualWindow: z.string(),
  variable: z.boolean(),
  phase: z.enum(["closing-soon", "open", "typically-open", "upcoming", "closed", "off-season"]),
  daysLeft: z.number().int().optional(),
  daysToOpen: z.number().int().optional(),
  monthsToOpen: z.number().int(),
  prepareNow: z.boolean(),
  prepare: z.array(z.string()),
  cycle: z
    .strictObject({
      label: z.string(),
      opens: isoDate.optional(),
      closes: isoDate.optional(),
      closesNote: z.string().optional(),
      note: z.string().optional(),
      /** `official`: read on the organiser's own page. `reported`: from news or a summary - confirm before relying on it. */
      confidence: z.enum(["official", "reported"]),
      checked: isoDate,
      source: httpUrl,
    })
    .optional(),
  official: httpUrl,
  reviewed: isoDate,
});

export const programmeQuery = z
  .object({
    q: safeText(200).optional(),
    kind: z.enum(OPPORTUNITY_KINDS).optional(),
    level: z.enum(LEVELS).optional(),
    funding: z.enum(FUNDING_TYPES).optional(),
    route: z.enum(["direct", "hec", "embassy", "agency", "university"]).optional(),
    lang: languageSchema.optional(),
    limit: intParam(1, 60).optional(),
  })
  .strict();
export const programmeListResponse = z.object({ data: z.array(programmeSchema), today: isoDate });
export const programmeIdParams = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/) });
export const langQuery = z.object({ lang: languageSchema.optional() }).strict();
export const programmeDetailResponse = z.object({ data: programmeSchema });

// ─── Guides and the resource directory ───────────────────────────────────────

export const guideSummarySchema = z.strictObject({
  id: z.string(),
  category: z.string(),
  emoji: z.string(),
  title: z.string(),
  summary: z.string(),
  steps: z.number().int(),
  duration: z.string().optional(),
  reviewed: isoDate,
  url: z.string(),
});
export const guideQuery = z.object({ q: safeText(200).optional(), category: z.string().max(30).optional(), lang: languageSchema.optional(), limit: intParam(1, 50).optional() }).strict();
export const guideListResponse = z.object({ data: z.array(guideSummarySchema) });

export const guideDetailSchema = guideSummarySchema.extend({
  audience: z.string(),
  steps: z.array(z.object({ title: z.string(), body: z.string(), when: z.string().optional(), resourceIds: z.array(z.string()) })),
  checklist: z.array(z.string()),
  pitfalls: z.array(z.string()),
  resources: z.array(z.object({ id: z.string(), name: z.string(), url: httpUrl })),
  related: z.array(z.string()),
  tools: z.array(z.string()),
  sources: z.array(z.string()),
});
export const guideIdParams = z.object({ id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,60}$/) });
export const guideDetailResponse = z.object({ data: guideDetailSchema });

export const resourceSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  url: httpUrl,
  category: z.enum(RESOURCE_CATEGORIES),
  scope: z.enum([...SCOPES, "both"]),
  authority: z.number().int(),
  tags: z.array(z.string()),
  free: z.boolean().optional(),
  checked: isoDate.optional(),
  note: z.string().optional(),
  linkStatus: z.enum(["ok", "blocked", "unreachable", "broken"]).optional(),
});
export const resourceQuery = z
  .object({
    q: safeText(200).optional(),
    category: z.enum(RESOURCE_CATEGORIES).optional(),
    scope: z.enum(SCOPES).optional(),
    free: boolParam.optional(),
    official: boolParam.optional(),
    lang: languageSchema.optional(),
    limit: intParam(1, 100).optional(),
  })
  .strict();
export const resourceListResponse = z.object({ data: z.array(resourceSchema), total: z.number().int() });

// ─── Tools ────────────────────────────────────────────────────────────────────

const answerShape = Object.fromEntries(ANSWER_KEYS.map((key) => [key, z.boolean().optional()])) as Record<(typeof ANSWER_KEYS)[number], z.ZodOptional<z.ZodBoolean>>;
const bilingual = z.object({ en: z.string(), ur: z.string() });

export const scamRequest = z.object({ text: safeText(6000).optional(), answers: z.object(answerShape).strict().optional() }).strict();
export const scamResponse = z.object({
  data: z.object({
    score: z.number().int().min(0).max(100),
    level: z.enum(["high", "medium", "low", "none"]),
    signals: z.array(z.object({ id: z.string(), weight: z.number(), en: z.string(), ur: z.string(), source: z.enum(["text", "answer"]) })),
    oepLicences: z.array(z.object({ raw: z.string(), number: z.string(), city: z.string() })),
    advice: z.array(z.object({ en: z.string(), ur: z.string(), url: httpUrl.optional(), label: bilingual.optional() })),
    headline: bilingual,
    disclaimer: bilingual,
  }),
});

export const ageRequest = z
  .object({
    dob: isoDate,
    asOn: isoDate,
    maxYears: z.number().int().min(0).max(120).optional(),
    relaxationYears: z.number().int().min(0).max(30).optional(),
    minYears: z.number().int().min(0).max(120).optional(),
  })
  .strict();
const ageParts = z.object({ years: z.number().int(), months: z.number().int(), days: z.number().int() });
export const ageResponse = z.object({
  data: z.object({
    age: ageParts,
    limit: z.number().int().optional(),
    withinByCompletedYears: z.boolean().optional(),
    withinToTheDay: z.boolean().optional(),
    meetsMinimum: z.boolean().optional(),
    lastDayByCompletedYears: isoDate.optional(),
    lastDayToTheDay: isoDate.optional(),
  }),
});

export const matchRequest = z
  .object({
    level: z.enum(LEVELS).optional(),
    fields: z.array(safeText(60)).max(10).optional(),
    interests: z.array(z.enum(OPPORTUNITY_KINDS)).max(OPPORTUNITY_KINDS.length).optional(),
    gender: z.enum(["female", "male"]).optional(),
    country: safeText(80).optional(),
    scope: z.enum(SCOPES).optional(),
    needsFunding: z.boolean().optional(),
    remoteOk: z.boolean().optional(),
    keywords: safeText(200).optional(),
    limit: z.number().int().min(1).max(30).optional(),
  })
  .strict();
export const matchResponse = z.object({
  data: z.array(z.object({ item: opportunitySchema, score: z.number(), reasons: z.array(bilingual), warnings: z.array(bilingual) })),
  meta: dataMeta,
});

// ─── Service, auth, operations ───────────────────────────────────────────────

export const healthResponse = z.object({ status: z.literal("ok"), time: isoInstant });
export const readyResponse = z.object({
  status: z.literal("ready"),
  checks: z.object({ database: z.literal("ok"), data: z.enum(["fresh", "stale"]), items: z.number().int() }),
});

export const metaResponse = z.object({
  api: z.object({
    version: z.literal("1"),
    build: z.string(),
    minimumClient: z.object({ android: z.string() }),
    deprecated: z.array(z.string()),
  }),
  server: z.object({ time: isoInstant }),
  data: z.object({ generatedAt: isoInstant.nullable(), total: z.number().int(), ageHours: z.number().nullable(), stale: z.boolean(), dataVersion: z.string() }),
  features: z.object({ deviceAuth: z.boolean(), assistant: z.boolean() }),
});

export const challengeResponse = z.object({
  challenge: z.string(),
  algorithm: z.literal("sha256-leading-zero-bits"),
  difficulty: z.number().int(),
  expiresAt: isoInstant,
});

export const deviceRequest = z
  .object({
    challenge: z.string().min(20).max(400),
    nonce: z.string().regex(/^\d{1,16}$/),
    installId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "installId must be a UUID"),
    platform: z.enum(["android", "ios", "web"]),
  })
  .strict();
export const deviceResponse = z.object({
  accessToken: z.string(),
  tokenType: z.literal("Bearer"),
  expiresIn: z.number().int(),
  scope: z.string(),
});

export const refreshQuery = z.object({ force: boolParam.optional() }).strict();
export const refreshResponse = z.object({
  generatedAt: isoInstant,
  items: z.number().int(),
  persisted: z.boolean(),
  sources: z.array(z.object({ id: z.string(), status: z.string(), items: z.number().int(), error: z.string().optional() })),
});

// ─── Moderation of partner submissions (admin) ───────────────────────────────

export const submissionId = z.string().regex(/^submission-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
export const submissionSummary = z.strictObject({
  id: z.string(),
  name: z.string(),
  nameUr: z.string(),
  organizationId: z.string(),
  domain: z.string(),
  sourceUrl: httpUrl,
  sourceTitle: z.string(),
  description: z.string(),
  submittedAt: isoInstant,
});
export const submissionListResponse = z.object({ data: z.array(submissionSummary), total: z.number().int() });
export const submissionParams = z.object({ id: submissionId });
export const reviewRequest = z
  .object({
    decision: z.enum(["approve", "reject"]),
    /** Authority tier to publish at: 1 = government ... 4. Defaults to 4 (lowest published tier). */
    authorityTier: z.number().int().min(1).max(4).optional(),
  })
  .strict();
export const reviewResponse = z.object({ id: z.string(), decision: z.enum(["approve", "reject"]), status: z.enum(["published", "discarded"]) });
