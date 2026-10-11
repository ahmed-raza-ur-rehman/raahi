import { parseDateRange, toIsoDate, toIsoDateTime } from "../../dates";
import { inferCountry, inferFields } from "../../infer";
import { cleanTitle, decodeEntities } from "../../text";
import type { RawOpportunity } from "../../types";
import type { Adapter } from "../types";

/**
 * JSON API adapters. Every parser is a pure function over the documented response shape so it
 * can be tested with recorded fixtures; the `Adapter` wrappers only add the network call.
 * Each provider's attribution / link-back requirement is honoured in the source registry and UI
 * (every item links to the provider's own listing and names the provider).
 */

type Json = Record<string, unknown>;
const asArray = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);
const asString = (value: unknown): string | undefined => (typeof value === "string" && value.trim() ? value.trim() : undefined);
const asNumber = (value: unknown): number | undefined => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : []);

// ─── Remotive (remote jobs) ──────────────────────────────────────────────────

export function parseRemotive(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const job of asArray((json as Json | undefined)?.jobs)) {
    const title = asString(job.title);
    const url = asString(job.url);
    if (!title || !url) continue;
    const salary = asString(job.salary);
    items.push({
      title,
      url,
      kind: "job",
      scope: "international",
      organization: asString(job.company_name),
      summary: asString(job.description),
      remote: true,
      location: asString(job.candidate_required_location),
      postedAt: toIsoDateTime(job.publication_date),
      tags: [asString(job.category), asString(job.job_type)?.replace(/_/g, " "), ...stringList(job.tags)].filter((t): t is string => Boolean(t)),
      funding: "paid",
      extra: salary ? { salary } : undefined,
    });
  }
  return items;
}

export const remotiveAdapter: Adapter = async ({ source, http }) => {
  const json = await http.getJson(`${source.endpoint}?limit=${source.maxItems ?? 60}`, { respectRobots: source.respectRobots });
  return parseRemotive(json);
};

// ─── Jobicy (remote jobs) ────────────────────────────────────────────────────

export function parseJobicy(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const job of asArray((json as Json | undefined)?.jobs)) {
    const title = asString(job.jobTitle);
    const url = asString(job.url);
    if (!title || !url) continue;
    const min = asNumber(job.annualSalaryMin) ?? asNumber(job.salaryMin);
    const max = asNumber(job.annualSalaryMax) ?? asNumber(job.salaryMax);
    const currency = asString(job.salaryCurrency);
    const extra: Record<string, string> = {};
    if (min || max) extra.salary = `${currency ?? ""} ${[min, max].filter(Boolean).join(" – ")}`.trim();
    items.push({
      title,
      url,
      kind: "job",
      scope: "international",
      organization: asString(job.companyName),
      summary: asString(job.jobExcerpt) ?? asString(job.jobDescription),
      remote: true,
      location: asString(job.jobGeo),
      postedAt: toIsoDateTime(job.pubDate),
      tags: [...stringList(job.jobIndustry), ...stringList(job.jobType), asString(job.jobLevel)].filter((t): t is string => Boolean(t)),
      funding: "paid",
      extra: Object.keys(extra).length > 0 ? extra : undefined,
    });
  }
  return items;
}

export const jobicyAdapter: Adapter = async ({ source, http }) => {
  const json = await http.getJson(`${source.endpoint}?count=${Math.min(source.maxItems ?? 50, 100)}`, { respectRobots: source.respectRobots });
  return parseJobicy(json);
};

// ─── Arbeitnow (jobs in Germany/Europe, visa-sponsorship friendly) ───────────

const VISA = /visa sponsor|sponsorship|relocation (?:package|support|assistance)|relocation/i;

export function parseArbeitnow(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const job of asArray((json as Json | undefined)?.data)) {
    const title = asString(job.title);
    const url = asString(job.url);
    if (!title || !url) continue;
    const remote = job.remote === true;
    const location = asString(job.location);
    const tags = [...stringList(job.tags), ...stringList(job.job_types)];
    const description = asString(job.description) ?? "";
    const visa = VISA.test(`${title} ${tags.join(" ")} ${description.slice(0, 4000)}`);
    items.push({
      title,
      url,
      kind: "job",
      scope: "international",
      organization: asString(job.company_name),
      summary: description,
      remote,
      location,
      country: (location ? inferCountry(location) : undefined) ?? "Germany",
      postedAt: toIsoDateTime(job.created_at),
      tags: [...tags, ...(visa ? ["visa sponsorship / relocation mentioned"] : [])],
      funding: "paid",
      eligibilityNote: remote ? undefined : "On-site role in Europe — a work visa or permit is normally required; check the posting for sponsorship.",
      extra: visa ? { visaMentioned: true } : undefined,
    });
  }
  return items;
}

export const arbeitnowAdapter: Adapter = async ({ source, http }) => {
  const json = await http.getJson(source.endpoint, { respectRobots: source.respectRobots });
  return parseArbeitnow(json).slice(0, source.maxItems ?? 60);
};

// ─── Devpost (hackathons) ────────────────────────────────────────────────────

export function parseDevpost(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const hackathon of asArray((json as Json | undefined)?.hackathons)) {
    const title = asString(hackathon.title);
    const url = asString(hackathon.url);
    if (!title || !url || hackathon.invite_only === true) continue;
    const location = asString((hackathon.displayed_location as Json | undefined)?.location);
    const prize = asString(hackathon.prize_amount)?.replace(/<[^>]+>/g, "");
    const range = parseDateRange(asString(hackathon.submission_period_dates) ?? "");
    const organization = asString(hackathon.organization_name);
    const registrations = asNumber(hackathon.registrations_count);
    const themes = asArray(hackathon.themes).map((theme) => asString(theme.name)).filter((t): t is string => Boolean(t));
    items.push({
      title,
      url: url.replace(/^\/\//, "https://"),
      kind: "competition",
      scope: "international",
      organization,
      summary: [
        location?.toLowerCase() === "online" ? "Online hackathon" : `Hackathon in ${location ?? "unspecified location"}`,
        organization ? `hosted by ${organization}` : undefined,
        prize ? `with ${decodeEntities(prize)} in prizes` : undefined,
        registrations ? `(${registrations.toLocaleString("en-US")} registered)` : undefined,
      ].filter(Boolean).join(" ") + ". Check the official rules for country restrictions.",
      location,
      remote: location?.toLowerCase() === "online",
      startsAt: range.start,
      deadline: range.end,
      deadlineText: asString(hackathon.submission_period_dates),
      tags: ["hackathon", ...themes.map((theme) => theme.toLowerCase())],
      extra: {
        ...(prize ? { prize: decodeEntities(prize) } : {}),
        ...(registrations ? { participants: registrations } : {}),
      },
    });
  }
  return items;
}

export const devpostAdapter: Adapter = async ({ source, http }) => {
  const pages = Math.min(Number(source.params?.pages ?? 3), 5);
  const collected: RawOpportunity[] = [];
  for (let page = 1; page <= pages; page += 1) {
    const query = new URLSearchParams([["status[]", "open"], ["order_by", "deadline"], ["page", String(page)]]);
    const json = await http.getJson(`${source.endpoint}?${query.toString()}`, { respectRobots: source.respectRobots });
    const items = parseDevpost(json);
    if (items.length === 0) break;
    collected.push(...items);
  }
  return collected.slice(0, source.maxItems ?? 40);
};

// ─── Codeforces (programming contests) ───────────────────────────────────────

export function parseCodeforces(json: unknown, now: Date, horizonDays = 45): RawOpportunity[] {
  const result = asArray((json as Json | undefined)?.result);
  const items: RawOpportunity[] = [];
  for (const contest of result) {
    if (contest.phase !== "BEFORE") continue;
    const id = asNumber(contest.id);
    const name = asString(contest.name);
    const start = asNumber(contest.startTimeSeconds);
    if (!id || !name || !start) continue;
    const startMs = start * 1000;
    if (startMs < now.getTime() || startMs > now.getTime() + horizonDays * 86_400_000) continue;
    const date = new Date(startMs);
    const iso = toIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    const hours = Math.round(((asNumber(contest.durationSeconds) ?? 0) / 3600) * 10) / 10;
    items.push({
      title: name,
      url: `https://codeforces.com/contests/${id}`,
      kind: "competition",
      scope: "international",
      organization: "Codeforces",
      summary: `Rated online programming contest (${asString(contest.type) ?? "CF"} rules)${hours ? `, ${hours} hours` : ""}. Starts ${date.toISOString().slice(0, 16).replace("T", " ")} UTC. Free to enter.`,
      remote: true,
      location: "Online",
      startsAt: iso,
      deadline: iso,
      deadlineText: `Starts ${date.toISOString().slice(0, 16).replace("T", " ")} UTC`,
      postedAt: now.toISOString(),
      tags: ["programming", "competitive-programming", "codeforces"],
      fields: ["computer-science"],
      funding: "free",
      openToPakistan: true,
    });
  }
  return items.sort((a, b) => (a.startsAt ?? "").localeCompare(b.startsAt ?? ""));
}

export const codeforcesAdapter: Adapter = async ({ source, http, now }) => {
  const json = await http.getJson(source.endpoint, { respectRobots: source.respectRobots });
  return parseCodeforces(json, now).slice(0, source.maxItems ?? 20);
};

// ─── Real.Discount (Udemy 100%-off coupons) ──────────────────────────────────

/**
 * We list the coupon *links* aggregators already publish. We never log in to Udemy, never
 * enrol on anyone's behalf and never call Udemy's private APIs. Coupons are first-come-first-served
 * and can sell out at any moment, so the UI says so and the feed drops them as soon as they vanish.
 */
export function parseRealDiscount(json: unknown): RawOpportunity[] {
  const items: RawOpportunity[] = [];
  for (const item of asArray((json as Json | undefined)?.items)) {
    if (item.type === "ad" || item.store !== "Udemy") continue; // skip sponsored placements
    if (asNumber(item.sale_price) !== 0) continue; // only fully discounted courses
    const url = asString(item.url);
    const name = asString(item.name);
    if (!url || !name || !/^https:\/\/(?:www\.)?udemy\.com\/course\//i.test(url)) continue;

    let couponCode: string | undefined;
    try {
      couponCode = new URL(url).searchParams.get("couponCode") ?? undefined;
    } catch {
      continue;
    }
    if (!couponCode) continue;

    const category = asString(item.category);
    const subcategory = asString(item.subcategory);
    const language = asString(item.language);
    const rating = asNumber(item.rating);
    const listPrice = asNumber(item.price);

    items.push({
      title: cleanTitle(name),
      url,
      kind: "coupon",
      scope: "international",
      organization: "Udemy",
      summary: asString(item.description),
      fields: inferFields(`${category ?? ""} ${subcategory ?? ""} ${name}`),
      tags: ["udemy", "100% off", category, subcategory, language].filter((t): t is string => Boolean(t)).map((t) => t.toLowerCase()),
      funding: "free",
      languages: language ? [language] : undefined,
      postedAt: toIsoDateTime(item.sale_start),
      openToPakistan: true,
      extra: {
        couponCode,
        ...(listPrice ? { listPrice } : {}),
        ...(rating ? { rating: Math.round(rating * 10) / 10 } : {}),
        ...(category ? { category } : {}),
        ...(subcategory ? { subcategory } : {}),
      },
    });
  }
  return items;
}

export const realDiscountAdapter: Adapter = async ({ source, http }) => {
  const limit = Math.min(source.maxItems ?? 150, 500);
  const json = await http.getJson(`${source.endpoint}?page=1&limit=${limit}&sortBy=sale_start&store=Udemy&freeOnly=true`, { respectRobots: source.respectRobots });
  return parseRealDiscount(json);
};
