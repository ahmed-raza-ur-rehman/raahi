import { toIsoDateTime } from "../../dates";
import { inferRemoteEligibility } from "../../infer";
import type { RawOpportunity } from "../../types";
import type { Adapter } from "../types";
import { parseFeed, type FeedItem } from "./feeds";

/**
 * Remote-job boards and online competitions that publish a free public API or feed.
 *
 * Shapes verified against live responses on 2026-10-11 (see tests/fixtures/opportunities/*.sample.*).
 * Each provider's terms are honoured in the source registry and in the UI:
 *  - Himalayas: link back to the listing and credit Himalayas; never resubmit its listings to Google Jobs,
 *    Jooble, LinkedIn etc. (RAAHI therefore emits no `JobPosting` structured data at all — a test guards that);
 *  - Remote OK: link back with a followed link and name Remote OK as the source;
 *  - We Work Remotely: public RSS, "attribute the links back to We Work Remotely";
 *  - Working Nomads, CTFtime: public JSON endpoints, links go to their own pages.
 * Jobs restricted to other countries are dropped at ingest: they are of no use to this audience.
 */

type Json = Record<string, unknown>;
const asArray = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]).filter((entry) => entry && typeof entry === "object") : []);
const asString = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : []);

function money(currency: string | undefined, min: number | undefined, max: number | undefined, period?: string): string | undefined {
  const figures = [min, max].filter((n): n is number => typeof n === "number" && n > 0).map((n) => n.toLocaleString("en-US"));
  if (figures.length === 0) return undefined;
  return `${currency ?? ""} ${figures.join(" – ")}${period ? ` / ${period}` : ""}`.trim();
}

const utcOffset = (hours: number) => `UTC${hours >= 0 ? "+" : "−"}${Math.abs(hours)}`;

// ─── Himalayas ───────────────────────────────────────────────────────────────

export function parseHimalayas(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const job of asArray((json as Json | undefined)?.jobs)) {
    const title = asString(job.title);
    const url = asString(job.guid) ?? asString(job.applicationLink);
    if (!title || !url) continue;

    const restrictions = stringList(job.locationRestrictions);
    const includesPakistan = restrictions.some((place) => /^pakistan$/i.test(place));
    const timezones = Array.isArray(job.timezoneRestrictions) ? (job.timezoneRestrictions as unknown[]).filter((n): n is number => typeof n === "number") : [];
    const notes: string[] = [];
    notes.push(restrictions.length === 0 ? "Advertised as open to applicants worldwide." : includesPakistan ? "Open to applicants in Pakistan." : `Open only to applicants in: ${restrictions.join(", ")}.`);
    if (timezones.length > 0 && timezones.length < 20) notes.push(`Expects overlap with ${utcOffset(Math.min(...timezones))} to ${utcOffset(Math.max(...timezones))}.`);

    const salary = money(asString(job.currency), asNumber(job.minSalary), asNumber(job.maxSalary), asString(job.salaryPeriod));
    const expires = toIsoDateTime(job.expiryDate);
    items.push({
      title,
      url,
      applyUrl: asString(job.applicationLink),
      kind: "job",
      scope: "international",
      organization: asString(job.companyName),
      summary: asString(job.excerpt) ?? asString(job.description),
      remote: true,
      location: restrictions.length === 0 ? "Worldwide" : restrictions.join(", "),
      openToPakistan: restrictions.length === 0 || includesPakistan,
      eligibilityNote: notes.join(" "),
      postedAt: toIsoDateTime(job.pubDate),
      deadline: expires?.slice(0, 10),
      deadlineText: expires ? "Listing expires on Himalayas" : undefined,
      tags: [...stringList(job.parentCategories), ...stringList(job.seniority), asString(job.employmentType)].filter((t): t is string => Boolean(t)),
      funding: "paid",
      extra: salary ? { salary } : undefined,
    });
  }
  return items;
}

/**
 * Himalayas' own search endpoint filters by country (`country=PK` returns jobs open to Pakistan and worldwide
 * ones, per its API reference), which is far better than paging the full feed: only a few percent of the newest
 * jobs there are open to people in Pakistan. If search is unavailable the cursor feed is used instead.
 */
export const himalayasAdapter: Adapter = async ({ source, http, log }) => {
  const wanted = source.maxItems ?? 60;
  const kept: RawOpportunity[] = [];
  const options = { respectRobots: source.respectRobots };

  try {
    for (let page = 1; page <= 5 && kept.length < wanted; page += 1) {
      const json = await http.getJson<Json>(`${source.endpoint}/search?country=PK&sort=recent&page=${page}`, options);
      const batch = parseHimalayas(json);
      if (batch.length === 0) break;
      kept.push(...batch.filter((item) => item.openToPakistan !== false));
    }
  } catch (error) {
    log(`search endpoint unavailable (${error instanceof Error ? error.message : "error"}); falling back to the cursor feed`);
  }

  if (kept.length === 0) {
    let cursor: string | undefined;
    for (let page = 0; page < 8 && kept.length < wanted; page += 1) {
      const json = await http.getJson<Json>(`${source.endpoint}?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`, options);
      const batch = parseHimalayas(json);
      kept.push(...batch.filter((item) => item.openToPakistan !== false));
      cursor = asString(json.nextCursor);
      if (!cursor || batch.length === 0) break;
    }
  }
  log(`${kept.length} jobs open to Pakistan kept`);
  return kept.slice(0, wanted);
};

// ─── Remote OK ───────────────────────────────────────────────────────────────

export function parseRemoteOk(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const job of asArray(json)) {
    // The first element of the response is the provider's legal notice, not a job.
    if (job.legal !== undefined || (job.position === undefined && job.last_updated !== undefined)) continue;
    const title = asString(job.position);
    const slug = asString(job.slug);
    const url = asString(job.url) ?? (slug ? `https://remoteok.com/remote-jobs/${slug}` : undefined);
    if (!title || !url) continue;
    const location = asString(job.location);
    const salary = money("USD", asNumber(job.salary_min), asNumber(job.salary_max), "year");
    items.push({
      title,
      url,
      applyUrl: asString(job.apply_url),
      kind: "job",
      scope: "international",
      organization: asString(job.company),
      summary: asString(job.description),
      remote: true,
      location,
      postedAt: toIsoDateTime(job.date) ?? toIsoDateTime(job.epoch),
      tags: stringList(job.tags),
      funding: "paid",
      extra: salary ? { salary } : undefined,
    });
  }
  return items;
}

export const remoteOkAdapter: Adapter = async ({ source, http }) => {
  const json = await http.getJson(source.endpoint, { respectRobots: source.respectRobots });
  return parseRemoteOk(json)
    .filter((item) => (item.location ? inferRemoteEligibility(item.location).openToPakistan !== false : true))
    .slice(0, source.maxItems ?? 60);
};

// ─── Working Nomads ──────────────────────────────────────────────────────────

export function parseWorkingNomads(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const job of asArray(json)) {
    const title = asString(job.title);
    const url = asString(job.url);
    if (!title || !url) continue;
    const location = asString(job.location);
    // "Time zone: CET (+/- 3 hours)" is an overlap preference, not a country restriction.
    const timezoneOnly = location ? /^time ?zone/i.test(location) : false;
    items.push({
      title,
      url,
      kind: "job",
      scope: "international",
      organization: asString(job.company_name),
      summary: asString(job.description),
      remote: true,
      location: timezoneOnly ? undefined : location,
      openToPakistan: timezoneOnly ? null : undefined,
      eligibilityNote: timezoneOnly ? `${location}. Check the time-zone overlap before applying.` : undefined,
      postedAt: toIsoDateTime(job.pub_date),
      tags: [asString(job.category_name), ...(asString(job.tags)?.split(",") ?? [])].filter((t): t is string => Boolean(t?.trim())).map((t) => t.trim()),
      funding: "paid",
    });
  }
  return items;
}

export const workingNomadsAdapter: Adapter = async ({ source, http }) => {
  const json = await http.getJson(source.endpoint, { respectRobots: source.respectRobots });
  return parseWorkingNomads(json)
    .filter((item) => (item.location ? inferRemoteEligibility(item.location).openToPakistan !== false : true))
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, source.maxItems ?? 40);
};

// ─── We Work Remotely ────────────────────────────────────────────────────────

export function parseWeWorkRemotely(items: FeedItem[]): RawOpportunity[] {
  const results: RawOpportunity[] = [];
  for (const item of items) {
    const colon = item.title.indexOf(":");
    const organization = colon > 0 ? item.title.slice(0, colon).trim() : undefined;
    const title = (colon > 0 ? item.title.slice(colon + 1) : item.title).trim();
    if (!title) continue;
    const region = item.fields.region?.trim();
    const place = [region, item.fields.country?.trim(), item.fields.state?.trim()].filter(Boolean).join(" · ");
    const expires = toIsoDateTime(item.fields.expires_at);
    results.push({
      title,
      url: item.link,
      kind: "job",
      scope: "international",
      organization,
      summary: item.summary,
      remote: true,
      location: place || undefined,
      postedAt: item.published ? toIsoDateTime(item.published) : undefined,
      deadline: expires?.slice(0, 10),
      deadlineText: expires ? "Listing expires on We Work Remotely" : undefined,
      tags: [...item.categories, item.fields.type, ...(item.fields.skills?.split(",") ?? [])].filter((t): t is string => Boolean(t?.trim())).map((t) => t.trim()),
      funding: "paid",
    });
  }
  return results;
}

export const weWorkRemotelyAdapter: Adapter = async ({ source, http }) => {
  const response = await http.getText(source.endpoint, { accept: "application/rss+xml,application/xml;q=0.9,*/*;q=0.5", respectRobots: source.respectRobots });
  return parseWeWorkRemotely(parseFeed(response.text))
    .filter((item) => (item.location ? inferRemoteEligibility(item.location).openToPakistan !== false : true))
    .slice(0, source.maxItems ?? 60);
};

// ─── CTFtime (cybersecurity competitions) ────────────────────────────────────

export function parseCtftime(json: unknown, now: Date): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const event of asArray(json)) {
    const title = asString(event.title);
    const url = asString(event.ctftime_url);
    const start = toIsoDateTime(event.start);
    const finish = toIsoDateTime(event.finish);
    if (!title || !url || !start) continue;
    if (finish && Date.parse(finish) < now.getTime()) continue;

    const restriction = asString(event.restrictions) ?? "Open";
    const onsite = event.onsite === true;
    const organizers = asArray(event.organizers).map((entry) => asString(entry.name)).filter((name): name is string => Boolean(name));
    const prizes = asString(event.prizes)?.replace(/\s+/g, " ");
    const format = asString(event.format);
    const location = asString(event.location);
    const startText = start.slice(0, 16).replace("T", " ");
    const note =
      restriction === "Open" ? undefined
        : restriction === "Academic" ? "Restricted to students / academic teams — read the rules to confirm you qualify."
          : `Entry restriction: ${restriction}.`;
    items.push({
      title,
      url,
      applyUrl: asString(event.url),
      kind: "competition",
      scope: "international",
      organization: organizers.join(", ") || undefined,
      summary: [format ? `${format} capture-the-flag` : "Capture-the-flag", onsite ? `on-site${location ? ` in ${location}` : ""}` : "online", `starts ${startText} UTC`, prizes && prizes !== "TBA" ? `prizes: ${prizes.slice(0, 120)}` : undefined].filter(Boolean).join(", ") + ".",
      remote: !onsite,
      location: onsite ? location : "Online",
      startsAt: start.slice(0, 10),
      deadline: start.slice(0, 10),
      deadlineText: `Starts ${startText} UTC`,
      postedAt: now.toISOString(),
      tags: ["ctf", "cybersecurity", ...(format ? [format.toLowerCase()] : [])],
      fields: ["computer-science"],
      funding: "free",
      openToPakistan: restriction === "Open" ? true : restriction === "Prequalified" ? false : null,
      eligibilityNote: note,
    });
  }
  return items;
}

export const ctftimeAdapter: Adapter = async ({ source, http, now }) => {
  const from = Math.floor(now.getTime() / 1000);
  const query = new URLSearchParams({ limit: String(Math.min(source.maxItems ?? 20, 50)), start: String(from), finish: String(from + 75 * 86_400) });
  const json = await http.getJson(`${source.endpoint}?${query.toString()}`, { respectRobots: source.respectRobots });
  return parseCtftime(json, now).slice(0, source.maxItems ?? 20);
};
