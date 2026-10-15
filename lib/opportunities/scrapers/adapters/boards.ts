import { addDays, diffDays, parseLooseDate, toIsoDate, toIsoDateTime, todayInPakistan } from "../../dates";
import { cleanTitle } from "../../text";
import type { RawOpportunity } from "../../types";
import { cheerio, makeResolver } from "../dom";
import type { Adapter } from "../types";

/**
 * Two active Pakistani job boards whose pages are plain, stable HTML (checked from GitHub's servers on 2026-10-15):
 *  - Pakistan Jobs Bank reposts the newspaper job advertisements (Dawn, Jang, The News, Express …);
 *  - GoPunjab explains the open Punjab government advertisements (PPSC, police …) with their last dates.
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

    const cell = $(row).children("td").first();
    const divs = cell.children("div");
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
      kind: undefined,
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

/** The day headers link to each day's advertisements (`/Jobs-in-Pakistan/2026-10-02/`). Most recent first, never in the future. */
export function pakistanJobsBankDayPages(html: string, baseUrl: string, now: Date, days = 5): string[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const today = todayInPakistan(now);
  const oldest = addDays(today, -Math.max(days, 1) - 2);
  const found = new Set<string>();
  $("a[href]").each((_, anchor) => {
    const match = /\/Jobs-in-Pakistan\/(\d{4}-\d{2}-\d{2})\/?(?:[#?]|$)/.exec($(anchor).attr("href") ?? "");
    if (!match || match[1] > today || match[1] < oldest) return;
    const url = resolve(`/Jobs-in-Pakistan/${match[1]}/`);
    if (url) found.add(url);
  });
  return [...found].sort().reverse().slice(0, days);
}

export const pakistanJobsBankAdapter: Adapter = async ({ source, http, now, log }) => {
  const home = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  const byUrl = new Map<string, RawOpportunity>();
  const add = (list: RawOpportunity[]) => {
    for (const item of list) if (!byUrl.has(item.url)) byUrl.set(item.url, item);
  };
  add(parsePakistanJobsBank(home.text, home.url));
  log(`home page: ${byUrl.size} advertisements`);

  // The home page carries the big Sunday supplements; the last few days' pages fill in the weekdays.
  for (const page of pakistanJobsBankDayPages(home.text, home.url, now, Number(source.params?.dayPages ?? 5))) {
    try {
      const response = await http.getText(page, { respectRobots: source.respectRobots });
      const before = byUrl.size;
      add(parsePakistanJobsBank(response.text, response.url));
      log(`${page.replace(PJB_ORIGIN, "/")}: ${byUrl.size - before} new advertisements`);
    } catch (error) {
      log(`${page.replace(PJB_ORIGIN, "/")} unavailable (${error instanceof Error ? error.message : "error"})`);
    }
  }

  const maxAgeDays = Number(source.params?.maxAgeDays ?? 14);
  const today = todayInPakistan(now);
  return [...byUrl.values()]
    .filter((item) => !item.postedAt || diffDays(item.postedAt.slice(0, 10), today) <= maxAgeDays)
    .sort((a, b) => (b.postedAt ?? "").localeCompare(a.postedAt ?? ""))
    .slice(0, source.maxItems ?? 60);
};

// ─── GoPunjab ────────────────────────────────────────────────────────────────

const GOPUNJAB_ORIGIN = "https://gopunjab.pk/";

/** Cards look like: `<a href="/jobs/slug/"><span>Punjab Police</span><span>Rahim Yar Khan Police Jobs 2026</span><span>1170 seats · Last date: 31 October 2026</span><span>20 days left</span></a>`. */
export function parseGoPunjab(html: string, baseUrl = GOPUNJAB_ORIGIN): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const byUrl = new Map<string, RawOpportunity>();

  $('a[href^="/jobs/"]').each((_, node) => {
    const anchor = $(node);
    const href = anchor.attr("href") ?? "";
    if (!/^\/jobs\/[^/?#]+\/?$/.test(href)) return; // the "/jobs/" index link is not a card
    const spans = anchor
      .children("span")
      .map((__, span) => $(span).text().replace(/\s+/g, " ").trim())
      .get();
    const detail = spans.find((text) => /last date/i.test(text));
    const url = resolve(href);
    if (!detail || !url || spans.length < 3 || byUrl.has(url)) return;

    const organization = cleanTitle(spans[0]);
    const name = cleanTitle(spans[1]);
    const deadline = parseLooseDate(detail.replace(/^.*?last date:?/i, ""));
    const seats = Number(/(\d[\d,]*)\s+seats?/i.exec(detail)?.[1]?.replace(/,/g, ""));
    byUrl.set(url, {
      title: organization && !name.toLowerCase().includes(organization.toLowerCase()) ? `${organization} — ${name}` : name,
      url,
      kind: "job",
      scope: "pakistan",
      organization: organization || undefined,
      summary: `Punjab government advertisement explained in plain words${Number.isFinite(seats) && seats > 0 ? ` (${seats.toLocaleString("en-US")} seats)` : ""}. Open it for eligibility and how to apply — and apply only on the department's official portal.`,
      location: "Punjab",
      deadline,
      deadlineText: detail.replace(/^.*?(last date)/i, "Last date").slice(0, 80),
      tags: ["government job", "punjab"],
      funding: "paid",
      extra: Number.isFinite(seats) && seats > 0 ? { vacancies: seats } : undefined,
    });
  });
  return [...byUrl.values()];
}

export const goPunjabAdapter: Adapter = async ({ source, http, now }) => {
  const response = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  const today = todayInPakistan(now);
  return parseGoPunjab(response.text, response.url)
    .filter((item) => !item.deadline || item.deadline >= today)
    .slice(0, source.maxItems ?? 40);
};
