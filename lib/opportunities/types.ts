import { z } from "zod";

/**
 * Shared types for the RAAHI Opportunities hub: scholarships, jobs, internships,
 * competitions, courses (incl. free coupons) and overseas-employment notices.
 *
 * Everything here is pure (no I/O, no Node-only imports) so client components can
 * import it safely.
 */

export const OPPORTUNITY_KINDS = [
  "scholarship",
  "fellowship",
  "internship",
  "job",
  "competition",
  "course",
  "coupon",
  "training",
  "grant",
  "admission",
  "notice",
] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

/** `pakistan` = located in / aimed at people in Pakistan. `international` = abroad, remote or global. */
export const SCOPES = ["pakistan", "international"] as const;
export type Scope = (typeof SCOPES)[number];

export const LEVELS = ["school", "undergraduate", "masters", "phd", "postdoc", "professional", "any"] as const;
export type Level = (typeof LEVELS)[number];

export const FUNDING_TYPES = ["full", "partial", "stipend", "paid", "free", "unknown"] as const;
export type Funding = (typeof FUNDING_TYPES)[number];

export type OpportunityStatus = "open" | "closing-soon" | "closed" | "rolling" | "unknown";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const isoDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
const extraValue = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const alsoOnSchema = z.object({ sourceName: z.string(), url: z.string() });
export type AlsoOn = z.infer<typeof alsoOnSchema>;

export const opportunitySchema = z.object({
  id: z.string().min(3),
  kind: z.enum(OPPORTUNITY_KINDS),
  scope: z.enum(SCOPES),
  title: z.string().min(3).max(300),
  organization: z.string().max(200).optional(),
  summary: z.string().max(600).optional(),
  url: z.string().regex(/^https?:\/\//),
  applyUrl: z.string().regex(/^https?:\/\//).optional(),
  sourceId: z.string().min(2),
  sourceName: z.string().min(2),
  sourceUrl: z.string().regex(/^https?:\/\//),
  country: z.string().max(80).optional(),
  location: z.string().max(200).optional(),
  remote: z.boolean().optional(),
  levels: z.array(z.enum(LEVELS)).default([]),
  fields: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  funding: z.enum(FUNDING_TYPES).optional(),
  deadline: isoDate.optional(),
  deadlineText: z.string().max(120).optional(),
  rolling: z.boolean().optional(),
  postedAt: isoDateTime.optional(),
  startsAt: isoDate.optional(),
  firstSeen: isoDateTime,
  lastSeen: isoDateTime,
  openToPakistan: z.boolean().nullable().optional(),
  eligibilityNote: z.string().max(240).optional(),
  languages: z.array(z.string()).optional(),
  extra: z.record(z.string(), extraValue).optional(),
  alsoOn: z.array(alsoOnSchema).optional(),
  dedupeKey: z.string().min(1),
});
export type Opportunity = z.infer<typeof opportunitySchema>;

/** What a scraper adapter hands to the normalizer. Only `title` and `url` are mandatory. */
export interface RawOpportunity {
  title: string;
  url: string;
  applyUrl?: string;
  kind?: OpportunityKind;
  scope?: Scope;
  organization?: string;
  /** Plain text or HTML; cleaned and truncated by the normalizer. */
  summary?: string;
  country?: string;
  location?: string;
  remote?: boolean;
  levels?: Level[];
  fields?: string[];
  tags?: string[];
  funding?: Funding;
  deadline?: string;
  deadlineText?: string;
  rolling?: boolean;
  postedAt?: string;
  startsAt?: string;
  openToPakistan?: boolean | null;
  eligibilityNote?: string;
  languages?: string[];
  extra?: Record<string, string | number | boolean | null>;
}

/** Opportunity as returned to clients: stored fields plus values that depend on "today". */
export interface OpportunityView extends Opportunity {
  status: OpportunityStatus;
  daysLeft: number | null;
  isNew: boolean;
}

// ─── Directory (evergreen links) ──────────────────────────────────────────────

export const RESOURCE_CATEGORIES = [
  "scholarships",
  "scholarships-pk",
  "jobs-pk",
  "govt-recruitment",
  "jobs-global",
  "overseas-employment",
  "internships",
  "competitions",
  "learning",
  "skills-pk",
  "coupons",
  "exam-prep",
  "grants",
  "research",
  "documents",
  "safety",
] as const;
export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

/**
 * 1 = government / regulator / official programme
 * 2 = university, international body, established institution
 * 3 = established nonprofit or learning platform
 * 4 = community aggregator or commercial job board (verify before acting)
 */
export type ResourceAuthority = 1 | 2 | 3 | 4;

export interface Resource {
  id: string;
  name: string;
  nameUr?: string;
  description: string;
  descriptionUr?: string;
  url: string;
  category: ResourceCategory;
  scope: Scope | "both";
  authority: ResourceAuthority;
  tags: string[];
  /** Free to use (no paywall for the core service). */
  free?: boolean;
  /** Scraper source id if RAAHI pulls live listings from this site. */
  sourceId?: string;
  /** YYYY-MM-DD: the day a human or tool confirmed the URL while building the directory. */
  checked?: string;
  /** Short caveat shown on the card, e.g. "Login required to view jobs". */
  note?: string;
  noteUr?: string;
  /** Existing RAAHI catalog services that complement this resource (validated by tests). */
  relatedServiceIds?: string[];
}

export interface LinkHealthEntry {
  ok: boolean;
  /** HTTP status, or 0 for network failure. */
  status: number;
  /**
   * "blocked" = the site refused our bot (403/429…); "unreachable" = no answer at all from our servers (timeout,
   * TLS or DNS failure — many .gov.pk sites do this to non-Pakistani networks). Neither is evidence that the link
   * is dead; only "broken" (404/410/5xx) is.
   */
  verdict: "ok" | "blocked" | "unreachable" | "broken";
  finalUrl?: string;
  checkedAt: string;
}

// ─── Scrape pipeline ──────────────────────────────────────────────────────────

export type SourceRunStatus = "ok" | "empty" | "error" | "skipped";

export interface SourceReport {
  sourceId: string;
  name: string;
  status: SourceRunStatus;
  items: number;
  durationMs: number;
  startedAt: string;
  lastSuccessAt?: string;
  error?: string;
  note?: string;
  experimental?: boolean;
}

export interface Snapshot {
  version: 1;
  generatedAt: string;
  sources: SourceReport[];
  items: Opportunity[];
}

export interface OpportunityQuery {
  q?: string;
  kinds?: OpportunityKind[];
  scope?: Scope;
  country?: string;
  level?: Level;
  funding?: Funding;
  openToPakistan?: boolean;
  /** Only remote / online items. */
  remote?: boolean;
  /** Only items whose deadline falls within N days (rolling/no-deadline items are excluded). */
  deadlineWithinDays?: number;
  /** Only items first seen within N days. */
  newWithinDays?: number;
  sourceId?: string;
  tag?: string;
  language?: string;
  includeClosed?: boolean;
  sort?: "relevance" | "newest" | "deadline";
  limit?: number;
  offset?: number;
}

export interface FacetCount {
  value: string;
  count: number;
}

export interface OpportunitySearchResult {
  total: number;
  items: OpportunityView[];
  facets: {
    kind: FacetCount[];
    scope: FacetCount[];
    country: FacetCount[];
    level: FacetCount[];
    funding: FacetCount[];
    source: FacetCount[];
  };
  /** How the query was interpreted (filters inferred from natural language). */
  interpreted: {
    terms: string[];
    kinds?: OpportunityKind[];
    country?: string;
    level?: Level;
    funding?: Funding;
    scope?: Scope;
    deadlineWithinDays?: number;
    remote?: boolean;
  };
}
