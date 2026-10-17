import { addDays, diffDays, parseLooseDate, toIsoDate, toIsoDateTime, todayInPakistan } from "../../dates";
import { cleanTitle } from "../../text";
import type { RawOpportunity } from "../../types";
import { cheerio, makeResolver } from "../dom";
import type { Adapter } from "../types";

/**
 * Two active Pakistani job boards whose pages are plain, stable HTML (checked from GitHub's servers on 2026-10-15):
 *  - Pakistan Jobs Bank reposts the newspaper job advertisements (Dawn, Jang, The News, Express …);
 *  - GoPunjab explains the open Punjab government advertisements (PPSC, police, authorities …) with their last dates.
 * Both are unofficial: every card says so and links to the board's own page, where the original advertisement is.
 */

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "04-Oct-2026" → "2026-10-04". */
function parseDayMonthYear(text: string): string | undefined {
  const match = /(\d{1,2})-([A-Za-z]{3})[a-z]*-(\d{4})/.exec(text);
  if (!match) return undefined;
  const month = MONTHS[match[2].toLowerCase()];
  return month ? toIsoDate(Number(match[3]), month, Number(match[1])) : undefined;
}

const shortDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTH_NAMES[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

// ─── Pakistan Jobs Bank ──────────────────────────────────────────────────────

const PJB_ORIGIN = "https://www.pakistanjobsbank.com/";

/** Rows look like: `<tr class="job-ad"><td><div>04-Oct-2026 (Sunday) - Dawn</div><strong><a href="/Jobs/74639/…">Title</a></strong><div>in Punjab, Pakistan</div></td><td><ul class="Positions"><li>…</li></ul></td></tr>`. */
export function parsePakistanJobsBank(html: string, baseUrl = PJB_ORIGIN): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const items: RawOpportunity[] = [];

  $("tr.job-ad").each((_, row) => {
    const link = $(row).find('strong a[href*="/Jobs/"]').first();
    const href = link.attr("href");
    const url = href ? resolve(href) : undefined;
    const title = cleanTitle(link.text());
    if (!url || title.length < 8) return;

    const divs = $(row).children("td").first().children("div");
    const meta = divs.first().text().replace(/\s+/g, " ").trim(); // "04-Oct-2026 (Sunday) - Dawn"
    const posted = parseDayMonthYear(meta);
    const paper = / - ([^-]+)$/.exec(meta)?.[1]?.trim();
    const location = divs.length > 1 ? divs.last().text().replace(/\s+/g, " ").replace(/^in\s+/i, "").trim() : undefined;
    const positions = $(row)
      .find("ul.Positions li")
      .map((__, li) => $(li).text().replace(/\s+/g, " ").trim())
      .get()
      .filter((text) => text && !/^=+.*=+$/.test(text)); // "=== BPS-04 ===" is a grade heading, not a post

    const posts = positions.length > 0 ? ` Posts: ${positions.slice(0, 6).join(", ")}${positions.length > 6 ? " …" : ""}.` : "";
    items.push({
      title,
      url,
      scope: "pakistan",
      summary: `${paper && posted ? `Advertised in ${paper} on ${shortDate(posted)}.` : "Newspaper advertisement."}${posts} Open the advertisement for qualifications, the last date and how to apply.`,
      location: location || undefined,
      postedAt: toIsoDateTime(posted),
      tags: ["newspaper ad", ...(paper ? [paper.toLowerCase()] : [])],
      funding: "paid",
    });
  });
  return items;
}

/**
 * The home page lists the latest newspaper days (the big Sunday supplements and whatever has been added since). Its
 * per-day archive pages are about 800 KB each and repeat the same table, so they are not read.
 */
export const pakistanJobsBankAdapter: Adapter = async ({ source, http, now }) => {
  const response = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  const maxAgeDays = Number(source.params?.maxAgeDays ?? 14);
  const today = todayInPakistan(now);
  const seen = new Set<string>();
  return parsePakistanJobsBank(response.text, response.url)
    .filter((item) => !seen.has(item.url) && seen.add(item.url))
    .filter((item) => !item.postedAt || diffDays(item.postedAt.slice(0, 10), today) <= maxAgeDays)
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, source.maxItems ?? 60);
};

// ─── GoPunjab ────────────────────────────────────────────────────────────────

const GOPUNJAB_ORIGIN = "https://gopunjab.pk/";
const DAYS_LEFT = /^(\d+)\s+days?\s+left$/i;

/**
 * `/jobs/` lists every open advertisement, most of them twice, in two card shapes (read from the real page):
 *  - full card: `<span>Organisation</span><span>Title</span><span>8 seats · BS-17 · Last date: 26 October 2026</span>`;
 *  - compact card (urgent or short-listed): `<span>4 days left</span><span>Title</span><span>Organisation · 10 seats</span>`.
 * 34 of the 54 jobs on the page appear only in the compact shape, so its badge is the only date. GoPunjab counts
 * inclusively (on the last day the badge says "1 days left", checked against jobs that show both), so the last day is
 * today + N − 1. "Today" is the UTC date, which is never later than Pakistan's: if the site counts from Pakistan's
 * date the result errs a day early, never late.
 */
export function parseGoPunjab(html: string, baseUrl = GOPUNJAB_ORIGIN, now: Date = new Date()): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const utcToday = now.toISOString().slice(0, 10);
  const byUrl = new Map<string, { item: RawOpportunity; explicit: boolean }>();

  $('a[href^="/jobs/"]').each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href") ?? "";
    if (!/^\/jobs\/[^/?#]+\/?$/.test(href)) return; // the "/jobs/" index link is not a card
    const spans = anchor
      .children("span")
      .map((__, span) => $(span).text().replace(/\s+/g, " ").trim())
      .get();
    const url = resolve(href);
    if (!url || spans.length < 3) return; // plain text links repeat cards that are already listed

    const badge = spans.find((text) => DAYS_LEFT.test(text));
    const rest = spans.filter((text) => text !== badge);
    const compact = badge !== undefined;
    const name = cleanTitle(compact ? rest[0] : rest[1]);
    const detail = (compact ? rest[1] : rest[2]) ?? "";
    const organization = cleanTitle(compact ? detail.split("·")[0] : rest[0]);
    if (!name) return;

    const explicitText = /last date:?\s*(.+)$/i.exec(detail)?.[1];
    const explicitDate = explicitText ? parseLooseDate(explicitText) : undefined;
    const daysLeft = badge ? Number(DAYS_LEFT.exec(badge)?.[1]) : undefined;
    const deadline = explicitDate ?? (daysLeft !== undefined && Number.isFinite(daysLeft) ? addDays(utcToday, Math.max(daysLeft - 1, 0)) : undefined);
    const seats = Number(/(\d[\d,]*)\s+seats?/i.exec(detail)?.[1]?.replace(/,/g, ""));

    const item: RawOpportunity = {
      title: organization && !name.toLowerCase().includes(organization.toLowerCase().slice(0, 12)) ? `${organization} — ${name}` : name,
      url,
      kind: "job",
      scope: "pakistan",
      organization: organization || undefined,
      summary: `Punjab government advertisement explained in plain words${Number.isFinite(seats) && seats > 0 ? ` (${seats.toLocaleString("en-US")} seat${seats === 1 ? "" : "s"})` : ""}. Open it for eligibility and how to apply — and apply only on the department's official portal.`,
      location: "Punjab",
      deadline,
      deadlineText: explicitDate && explicitText ? `Last date: ${explicitText.trim()}`.slice(0, 80) : deadline ? `About ${daysLeft} day${daysLeft === 1 ? "" : "s"} left (as shown by GoPunjab) — confirm the exact date` : undefined,
      tags: ["government job", "punjab"],
      funding: "paid",
      extra: Number.isFinite(seats) && seats > 0 ? { vacancies: seats } : undefined,
    };
    // A job often appears twice; the card with an explicit last date is the better record.
    const existing = byUrl.get(url);
    const explicit = explicitDate !== undefined;
    if (!existing || (explicit && !existing.explicit)) byUrl.set(url, { item, explicit });
  });
  return [...byUrl.values()].map((entry) => entry.item);
}

export const goPunjabAdapter: Adapter = async ({ source, http, now }) => {
  const response = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  const today = todayInPakistan(now);
  return parseGoPunjab(response.text, response.url, now)
    .filter((item) => !item.deadline || item.deadline >= today)
    .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
    .slice(0, source.maxItems ?? 60);
};
