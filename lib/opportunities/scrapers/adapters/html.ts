import { parseLooseDate, toIsoDateTime } from "../../dates";
import { cleanTitle, tidyCase, truncate } from "../../text";
import type { RawOpportunity } from "../../types";
import { cheerio, findCards, makeResolver, textTokens } from "../dom";
import type { Adapter } from "../types";

/**
 * HTML adapters. These read rendered pages (no documented API exists), so they are written to
 * survive cosmetic changes: cards are located through their detail links, and fields are read
 * from text tokens by label ("Deadline:", "Available Till", "by …") rather than CSS classes.
 * They are flagged `experimental` in the source registry and verified by the scheduled run.
 */

// ─── ScholarshipTab ───────────────────────────────────────────────────────────

const SCHOLARSHIPTAB_DETAIL = /^https?:\/\/(?:www\.)?scholarshiptab\.com\/scholarships\/[^/?#]+$/i;

export function parseScholarshipTab(html: string, baseUrl = "https://www.scholarshiptab.com/"): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const items: RawOpportunity[] = [];

  for (const card of findCards($, SCHOLARSHIPTAB_DETAIL, resolve)) {
    const title = cleanTitle(card.titleAnchor.text());
    if (title.length < 4) continue;

    const tokens = textTokens(card.element);
    const joined = tokens.join(" ");
    const deadlineText = /Deadline:?\s*(.+?)(?=\s+Posted:?|\s*$)/i.exec(joined)?.[1]?.trim();
    const postedText = /Posted:?\s*(.+?)$/i.exec(joined)?.[1]?.trim();

    const titleIndex = tokens.findIndex((token) => cleanTitle(token) === title);
    const deadlineIndex = tokens.findIndex((token) => /^Deadline/i.test(token));
    const descriptionTokens = tokens
      .slice(titleIndex >= 0 ? titleIndex + 1 : 0, deadlineIndex > 0 ? deadlineIndex : undefined)
      .filter((token) => !/^(Featured|Sponsored|Posted:?)$/i.test(token) && token !== title);

    const deadline = deadlineText ? parseLooseDate(deadlineText) : undefined;
    const posted = postedText ? parseLooseDate(postedText) : undefined;

    items.push({
      title,
      url: card.href,
      summary: descriptionTokens.join(" ") || undefined,
      deadline,
      deadlineText: deadlineText ? `Deadline: ${deadlineText}` : undefined,
      postedAt: posted ? `${posted}T00:00:00Z` : undefined,
    });
  }
  return items;
}

export const scholarshipTabAdapter: Adapter = async ({ source, http }) => {
  const page = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  return parseScholarshipTab(page.text, source.endpoint).slice(0, source.maxItems ?? 80);
};

// ─── National Job Portal (njp.gov.pk) ────────────────────────────────────────

const NJP_DETAIL = /^https?:\/\/(?:www\.)?njp\.gov\.pk\/jobs\/\d+$/i;
const JOB_TYPE = /^(regular|contract|internship|part[- ]time|daily wages?|contingent|deputation|temporary|adhoc|ad hoc|lump[- ]sum pay)$/i;
const NJP_GRADE = /^([A-Za-z]{1,6})[-\s]?(\d{1,6})(\([A-Z]\))?$/;
const NJP_ROMAN_GRADE = /^([A-Za-z]{1,6})[-\s]([IVX]{1,5})$/;

/** Highest grade number on each pay scale (taken from NJP's own "Job Scale" filter). */
const MAX_GRADE: Record<string, number> = { BPS: 22, PPS: 12, SPS: 10, NFAPS: 10, G: 10, T: 10, GRADE: 20, LEVEL: 6, OG: 7, OP: 4, PSG: 6, NITS: 5, PHFPS: 5, PPG: 2, M: 7, MP: 3, R: 1 };

/**
 * When the grade and the vacancy count are rendered without a gap ("PPS-71" = PPS-7 + 1 vacancy),
 * split them using the scale's maximum grade. Only used when no separate count is present.
 */
function splitGlued(prefix: string, digits: string): { grade: string; count?: number } {
  if (digits.length >= 3) return { grade: digits.slice(0, 2), count: Number(digits.slice(2)) };
  if (digits.length === 2 && Number(digits) > (MAX_GRADE[prefix.toUpperCase()] ?? 22)) return { grade: digits[0], count: Number(digits[1]) };
  return { grade: digits };
}

export function parseNjpJobs(html: string, baseUrl = "https://njp.gov.pk/"): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const items: RawOpportunity[] = [];

  for (const card of findCards($, NJP_DETAIL, resolve)) {
    const title = cleanTitle(card.titleAnchor.text());
    if (title.length < 3 || /^(view details|apply now)/i.test(title)) continue;

    const tokens = textTokens(card.element);

    // Employer: "by Ministry of …" in one token, or "by" followed by the name.
    let organization: string | undefined;
    const byIndex = tokens.findIndex((token) => /^by\b/i.test(token));
    if (byIndex >= 0) {
      const inline = tokens[byIndex].replace(/^by\s*/i, "").trim();
      organization = inline || tokens[byIndex + 1];
    }

    // "Contract" · "BPS-20" · "1" · "Vacancy" (the pieces can arrive glued or separate).
    const typeIndex = tokens.findIndex((token) => JOB_TYPE.test(token));
    const jobType = typeIndex >= 0 ? tokens[typeIndex] : undefined;

    let vacancies: number | undefined;
    const countIndex = tokens.findIndex((token, index) => /^\d+$/.test(token) && /^vacanc/i.test(tokens[index + 1] ?? ""));
    if (countIndex >= 0) vacancies = Number(tokens[countIndex]);
    else {
      const inline = tokens.map((token) => /^(\d+)\s*vacanc/i.exec(token)?.[1]).find(Boolean);
      if (inline) vacancies = Number(inline);
    }

    let grade: string | undefined;
    if (typeIndex >= 0) {
      const next = tokens[typeIndex + 1];
      const numeric = next ? NJP_GRADE.exec(next) : null;
      const roman = next ? NJP_ROMAN_GRADE.exec(next) : null;
      if (numeric) {
        const split = vacancies === undefined ? splitGlued(numeric[1], numeric[2]) : { grade: numeric[2], count: undefined };
        grade = `${numeric[1].toUpperCase()}-${split.grade}${numeric[3] ?? ""}`;
        if (split.count !== undefined) vacancies = split.count;
      } else if (roman) {
        grade = `${roman[1].toUpperCase()}-${roman[2]}`;
      } else if (next && !/^(vacanc|experience|available)/i.test(next) && !/^\d+$/.test(next) && next.length <= 24) {
        grade = next;
      }
    }

    const joined = tokens.join(" ");
    const experience = /Experience:?\s*(\d+)\+?\s*Years?/i.exec(joined)?.[1];
    const availableTill = /Available Till:?\s*([A-Za-z]{3,9}\.? \d{1,2},? \d{4})/i.exec(joined)?.[1];
    const deadline = availableTill ? parseLooseDate(availableTill) : undefined;

    const facts = [
      jobType,
      grade,
      vacancies ? `${vacancies} vacanc${vacancies === 1 ? "y" : "ies"}` : undefined,
      experience ? `${experience}+ years experience` : undefined,
    ].filter(Boolean);

    items.push({
      title,
      url: card.href,
      kind: "job",
      scope: "pakistan",
      organization: organization ? tidyCase(cleanTitle(organization)) : undefined,
      country: "Pakistan",
      summary: [facts.join(" · "), organization ? `Employer: ${tidyCase(cleanTitle(organization))}.` : undefined].filter(Boolean).join(". "),
      deadline,
      deadlineText: availableTill ? `Available till ${availableTill}` : undefined,
      tags: ["government", "njp", jobType?.toLowerCase(), grade?.toLowerCase()].filter((t): t is string => Boolean(t)),
      funding: "paid",
      extra: {
        ...(grade ? { grade } : {}),
        ...(vacancies ? { vacancies } : {}),
        ...(experience ? { experienceYears: Number(experience) } : {}),
        ...(jobType ? { jobType } : {}),
      },
    });
  }
  return items;
}

function findNextPage($: cheerio.CheerioAPI, current: string): string | undefined {
  const resolve = makeResolver(current);
  const rel = $('a[rel="next"], link[rel="next"]').first().attr("href");
  if (rel) return resolve(rel);
  let found: string | undefined;
  $("a[href]").each((_, node) => {
    if (found) return;
    const text = $(node).text().replace(/\s+/g, " ").trim();
    const href = $(node).attr("href") ?? "";
    if (/^(next|›|»|>|next page)$/i.test(text) && /page=\d+/.test(href)) found = resolve(href);
  });
  return found && found !== current ? found : undefined;
}

export const njpAdapter: Adapter = async ({ source, http, log }) => {
  const maxPages = Number(source.params?.maxPages ?? 8);
  const collected = new Map<string, RawOpportunity>();
  let url: string | undefined = source.endpoint;

  for (let page = 0; page < maxPages && url; page += 1) {
    const response = await http.getText(url, { respectRobots: source.respectRobots });
    const items = parseNjpJobs(response.text, url);
    for (const item of items) collected.set(item.url, item);
    if (items.length === 0) break;
    url = findNextPage(cheerio.load(response.text), url);
  }

  if (collected.size === 0 && source.params?.fallbackUrl) {
    log("Live job list produced no cards; trying the home page");
    const response = await http.getText(String(source.params.fallbackUrl), { respectRobots: source.respectRobots });
    for (const item of parseNjpJobs(response.text, String(source.params.fallbackUrl))) collected.set(item.url, item);
  }
  return [...collected.values()].slice(0, source.maxItems ?? 120);
};

// ─── BEOE regulator notices ──────────────────────────────────────────────────

const BEOE_NOTICE = /^https?:\/\/(?:www\.)?beoe\.gov\.pk\/(?:news-updates|complaints\/results|pressrelease-updates|office-orders-and-circulars)\/\d+$/i;
const DATE_AT_END = /([A-Za-z]{3,9}\.?\s*\d{1,2},?\s*\d{4})\s*$/;

function beoeCategory(title: string): string {
  if (/blacklist/i.test(title)) return "blacklisting";
  if (/show[- ]cause/i.test(title)) return "show-cause-notice";
  if (/hearing/i.test(title)) return "hearing";
  if (/warning/i.test(title)) return "warning";
  if (/complaint/i.test(title)) return "complaint";
  if (/press release/i.test(title)) return "press-release";
  return "notice";
}

export function parseBeoeNotices(html: string, baseUrl = "https://beoe.gov.pk/"): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const byUrl = new Map<string, RawOpportunity>();

  $("a[href]").each((_, node) => {
    const href = resolve($(node).attr("href") ?? "");
    if (!href || !BEOE_NOTICE.test(href)) return;
    const text = textTokens($(node)).join(" ").replace(/\s+/g, " ").trim();
    if (!text) return;

    const dateMatch = DATE_AT_END.exec(text);
    const date = dateMatch ? parseLooseDate(dateMatch[1].replace(/(\d),(\d)/, "$1, $2")) : undefined;
    const title = cleanTitle(dateMatch ? text.slice(0, dateMatch.index) : text);
    if (title.length < 8) return;

    const category = beoeCategory(title);
    byUrl.set(href, {
      title: truncate(title, 200),
      url: href,
      kind: "notice",
      scope: "pakistan",
      organization: "Bureau of Emigration & Overseas Employment (BE&OE)",
      country: "Pakistan",
      summary: "Official notice published by the Bureau of Emigration & Overseas Employment. Read the full text on the BE&OE website.",
      postedAt: date ? toIsoDateTime(`${date}T00:00:00Z`) : undefined,
      tags: ["beoe", "overseas-employment", "regulator-notice", category],
      openToPakistan: true,
    });
  });
  return [...byUrl.values()];
}

export const beoeNoticesAdapter: Adapter = async ({ source, http }) => {
  const pages = [source.endpoint, ...(source.params?.extraUrl ? [String(source.params.extraUrl)] : [])];
  const byUrl = new Map<string, RawOpportunity>();
  let lastError: unknown;
  for (const page of pages) {
    try {
      const response = await http.getText(page, { respectRobots: source.respectRobots });
      for (const item of parseBeoeNotices(response.text, page)) byUrl.set(item.url, item);
    } catch (error) {
      lastError = error;
    }
  }
  if (byUrl.size === 0 && lastError) throw lastError;
  return [...byUrl.values()].slice(0, source.maxItems ?? 60);
};
