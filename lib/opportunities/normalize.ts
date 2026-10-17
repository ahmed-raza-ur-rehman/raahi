import { diffDays, extractDeadline, toIsoDate, toIsoDateTime } from "./dates";
import {
  inferCountry,
  inferEligibility,
  inferFields,
  inferFunding,
  inferKind,
  inferLevels,
  inferRemoteEligibility,
} from "./infer";
import { canonicalUrl, cleanTitle, dedupeKeyFor, stableHash, stripHtml, truncate, uniq } from "./text";
import {
  opportunitySchema,
  type Opportunity,
  type OpportunityKind,
  type RawOpportunity,
  type Scope,
} from "./types";

export interface SourceMeta {
  id: string;
  name: string;
  homepage: string;
  defaultKind: OpportunityKind;
  scope: Scope;
}

export interface NormalizeResult {
  items: Opportunity[];
  rejected: Array<{ title: string; reason: string }>;
}

const DEADLINE_KINDS: ReadonlySet<OpportunityKind> = new Set(["scholarship", "fellowship", "internship", "job", "competition", "grant", "admission", "training", "course"]);
const SUMMARY_LIMIT = 280;
/** Only the start of a long post is read: eligibility and deadlines are stated near the top, the rest is noise. */
const BODY_LIMIT = 6000;
const BODY_ELIGIBILITY_WINDOW = 3000;
/**
 * A date picked out of free text is only believed if it is a plausible closing date for the kind of listing:
 * job ads close within weeks, scholarships can be announced more than a year ahead. Anything further out is usually
 * a different date in the text (an age cut-off, a start date, a copy-paste from last year).
 */
const MAX_TEXT_DEADLINE_LEAD_DAYS: Partial<Record<OpportunityKind, number>> = { job: 150, internship: 210, admission: 240 };
const DEFAULT_TEXT_DEADLINE_LEAD_DAYS = 540;

function validIso(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? toIsoDate(Number(match[1]), Number(match[2]), Number(match[3])) : undefined;
}

export function opportunityId(sourceId: string, url: string): string {
  return `${sourceId}-${stableHash(url).slice(0, 10)}`;
}

export function normalizeOpportunity(raw: RawOpportunity, source: SourceMeta, now: Date): { item?: Opportunity; reason?: string } {
  const title = cleanTitle(raw.title).slice(0, 300);
  if (title.length < 3) return { reason: "missing title" };

  const url = canonicalUrl(raw.url);
  if (!url) return { reason: "invalid url" };
  const applyUrl = raw.applyUrl ? canonicalUrl(raw.applyUrl) : undefined;

  const organization = raw.organization ? cleanTitle(raw.organization).slice(0, 200) || undefined : undefined;
  const bodyText = raw.body ? stripHtml(raw.body).slice(0, BODY_LIMIT) : "";
  let summaryText = raw.summary ? stripHtml(raw.summary) : "";
  // Some feeds send an empty or one-line teaser; the opening of the post is a better summary than nothing.
  if (summaryText.length < 40 && bodyText.length > summaryText.length) summaryText = bodyText;
  const summary = summaryText ? truncate(summaryText, SUMMARY_LIMIT) : undefined;
  const inferText = summaryText.slice(0, 1200);
  const text = `${title}. ${inferText}`;

  const kind = raw.kind ?? inferKind(title, inferText, source.defaultKind);
  const scope = raw.scope ?? source.scope;

  const country = raw.country ?? (scope === "pakistan" ? "Pakistan" : inferCountry(title) ?? inferCountry(inferText));
  const levels = raw.levels && raw.levels.length > 0 ? raw.levels : kind === "notice" ? [] : inferLevels(text);
  const fields = raw.fields && raw.fields.length > 0 ? raw.fields : kind === "notice" ? [] : inferFields(text);
  const funding = raw.funding ?? (kind === "notice" ? undefined : (inferFunding(text) ?? (bodyText ? inferFunding(bodyText.slice(0, BODY_ELIGIBILITY_WINDOW)) : undefined)));

  let deadline = validIso(raw.deadline);
  let deadlineText = raw.deadlineText?.slice(0, 120);
  let rolling = raw.rolling;
  if (!deadline && DEADLINE_KINDS.has(kind)) {
    // A year-less date ("Apply by 1 October") belongs to the year the item was posted in, or the coming one.
    const reference = (toIsoDateTime(raw.postedAt) ?? now.toISOString()).slice(0, 10);
    let extracted = extractDeadline(text, { reference });
    // The teaser rarely carries the deadline; the post itself usually does ("Deadline: 15 December 2026").
    if (!extracted.date && bodyText) extracted = { ...extractDeadline(bodyText, { reference }), rolling: extracted.rolling };
    if (extracted.date && diffDays(reference, extracted.date) > (MAX_TEXT_DEADLINE_LEAD_DAYS[kind] ?? DEFAULT_TEXT_DEADLINE_LEAD_DAYS)) {
      extracted = { rolling: extracted.rolling };
    }
    deadline = extracted.date;
    deadlineText ??= extracted.text;
    rolling ??= extracted.rolling;
  }

  let postedAt = toIsoDateTime(raw.postedAt);
  if (postedAt && Date.parse(postedAt) > now.getTime() + 86_400_000) postedAt = now.toISOString();

  let openToPakistan = raw.openToPakistan;
  let eligibilityNote = raw.eligibilityNote;
  if (openToPakistan === undefined) {
    if (scope === "pakistan") {
      openToPakistan = true;
    } else if (raw.remote && raw.location) {
      const guess = inferRemoteEligibility(raw.location);
      openToPakistan = guess.openToPakistan;
      eligibilityNote ??= guess.note;
    } else if (kind === "notice" || kind === "coupon" || kind === "course") {
      openToPakistan = true; // online learning and Pakistani regulator notices are not nationality-limited
    } else {
      let guess = inferEligibility(text);
      if (guess.openToPakistan === null && bodyText) guess = inferEligibility(bodyText.slice(0, BODY_ELIGIBILITY_WINDOW));
      openToPakistan = guess.openToPakistan;
      eligibilityNote ??= guess.note;
    }
  }

  const tags = uniq((raw.tags ?? []).map((tag) => cleanTitle(tag).toLowerCase()).filter((tag) => tag.length > 1 && tag.length < 40)).slice(0, 12);

  const nowIso = now.toISOString();
  const dedupeKey =
    kind === "coupon" || kind === "notice"
      ? `${kind}:${url}`
      : dedupeKeyFor(title, kind === "job" ? organization : undefined);

  const candidate = {
    id: opportunityId(source.id, url),
    kind,
    scope,
    title,
    organization,
    summary,
    url,
    applyUrl,
    sourceId: source.id,
    sourceName: source.name,
    sourceUrl: source.homepage,
    country,
    location: raw.location?.slice(0, 200),
    remote: raw.remote,
    levels,
    fields,
    tags,
    funding,
    deadline,
    deadlineText,
    rolling,
    postedAt,
    startsAt: validIso(raw.startsAt),
    firstSeen: nowIso,
    lastSeen: nowIso,
    openToPakistan,
    eligibilityNote: eligibilityNote?.slice(0, 240),
    languages: raw.languages,
    extra: raw.extra,
    dedupeKey,
  };

  const parsed = opportunitySchema.safeParse(stripUndefined(candidate));
  if (!parsed.success) {
    return { reason: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ").slice(0, 200) };
  }
  return { item: parsed.data };
}

export function normalizeAll(raws: RawOpportunity[], source: SourceMeta, now: Date): NormalizeResult {
  const items: Opportunity[] = [];
  const rejected: Array<{ title: string; reason: string }> = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    const { item, reason } = normalizeOpportunity(raw, source, now);
    if (!item) {
      rejected.push({ title: String(raw.title ?? "").slice(0, 80), reason: reason ?? "invalid" });
      continue;
    }
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return { items, rejected };
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}
