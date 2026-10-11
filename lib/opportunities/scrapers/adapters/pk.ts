import { parseLooseDate, todayInPakistan, toIsoDateTime } from "../../dates";
import { cleanTitle } from "../../text";
import type { RawOpportunity } from "../../types";
import { cheerio, makeResolver } from "../dom";
import type { Adapter } from "../types";

/**
 * Pakistani public-service commissions and testing agencies that can be reached from GitHub's servers
 * (many other `.gov.pk` sites cannot — see README, "Sources that need a Pakistani network").
 *
 * The parsers were written against the real pages captured by the live probe on 2026-10-11, and each
 * item links to the official advertisement (usually a PDF) — the posts, qualifications, age limits and last
 * date are in that document, which we never copy.
 */

// ─── Sindh Public Service Commission ─────────────────────────────────────────

const SPSC_AD = /^Advertisement\s+(\d{1,2})\s*\/\s*(\d{2,4})\b/i;

export function parseSpsc(html: string, baseUrl = "https://spsc.gos.pk/"): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const byUrl = new Map<string, RawOpportunity>();

  $("a[href]").each((_, node) => {
    const anchor = $(node);
    const text = anchor.text().replace(/\s+/g, " ").trim();
    const match = SPSC_AD.exec(text);
    const url = resolve(anchor.attr("href") ?? "");
    if (!match || !url || byUrl.has(url)) return;

    const status = text.slice(match[0].length).trim();
    // Only advertisements that are still open are useful; the page keeps years of closed ones.
    if (!/closing/i.test(status)) return;
    const deadline = parseLooseDate(status);
    if (!deadline) return;

    const year = match[2].length === 2 ? 2000 + Number(match[2]) : Number(match[2]);
    const number = match[1].padStart(2, "0");
    byUrl.set(url, {
      title: `Sindh Public Service Commission — Advertisement ${number}/${year}`,
      url,
      kind: "job",
      scope: "pakistan",
      organization: "Sindh Public Service Commission",
      summary: `Official SPSC advertisement ${number}/${year} (PDF). Open it for the posts, qualifications, age limits and how to apply.`,
      location: "Sindh",
      deadline,
      deadlineText: status.replace(/\.$/, ""),
      tags: ["government job", "sindh", "public service commission"],
      funding: "paid",
    });
  });
  return [...byUrl.values()];
}

export const spscAdapter: Adapter = async ({ source, http, now }) => {
  const response = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  // Some old advertisements still carry a "Closing dt" label long after that date.
  const today = todayInPakistan(now);
  return parseSpsc(response.text, response.url)
    .filter((item) => !item.deadline || item.deadline >= today)
    .slice(0, source.maxItems ?? 30);
};

// ─── Balochistan Public Service Commission ───────────────────────────────────

const BPSC_AD = /^(?:public notice\s*\/\s*)?advertisement\s*(?:no\.?)?\s*(\d{1,2})\s*[-/]\s*(\d{4})/i;
const BPSC_NOT_AN_OPENING = /corrigendum|press release|departmental exam|website maintenance|maintainance/i;

/** The PDF names on bpsc.gob.pk are Unix timestamps of the upload, which dates an advertisement reliably. */
function bpscUploadDate(href: string, now: Date): string | undefined {
  const seconds = Number(/\/(\d{10})\.pdf/i.exec(href)?.[1]);
  if (!Number.isFinite(seconds)) return undefined;
  const ms = seconds * 1000;
  if (ms < Date.UTC(2020, 0, 1) || ms > now.getTime() + 86_400_000) return undefined;
  return new Date(ms).toISOString();
}

export function parseBpsc(html: string, baseUrl = "https://bpsc.gob.pk/BPSC/pages?jobs", now: Date = new Date()): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const items: RawOpportunity[] = [];

  $("table tr").each((_, row) => {
    const cells = $(row).children("td");
    if (cells.length < 2) return;
    const label = cells.first().text().replace(/\s+/g, " ").trim();
    const href = cells.eq(1).find("a[href]").attr("href");
    const url = href ? resolve(href) : undefined;
    const match = BPSC_AD.exec(label);
    if (!match || !url || BPSC_NOT_AN_OPENING.test(label)) return;

    const number = match[1].padStart(2, "0");
    const postedAt = toIsoDateTime(parseLooseDate(label)) ?? bpscUploadDate(url, now);
    items.push({
      title: `Balochistan Public Service Commission — Advertisement ${number}/${match[2]}`,
      url,
      applyUrl: "https://bpsc.gob.pk/apply_now",
      kind: "job",
      scope: "pakistan",
      organization: "Balochistan Public Service Commission",
      summary: `Official BPSC advertisement ${number}/${match[2]} (PDF). Open it for the posts, qualifications and the last date to apply.`,
      location: "Balochistan",
      postedAt,
      tags: ["government job", "balochistan", "public service commission"],
      funding: "paid",
    });
  });
  return items;
}

export const bpscAdapter: Adapter = async ({ source, http, now }) => {
  const response = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  const maxAgeMs = Number(source.params?.maxAgeDays ?? 45) * 86_400_000;
  return parseBpsc(response.text, response.url, now)
    // The page lists every advertisement ever published and the last date is inside each PDF, so only
    // recent ones are shown as current.
    .filter((item) => !item.postedAt || now.getTime() - Date.parse(item.postedAt) <= maxAgeMs)
    .slice(0, source.maxItems ?? 20);
};

// ─── ETEA (Khyber Pakhtunkhwa testing agency) ────────────────────────────────

const ETEA_NOT_AN_OPENING = /merit list|result|roll number|answer key|admit card|schedule|retotal/i;

export function parseEtea(html: string, baseUrl = "https://www.etea.edu.pk/"): RawOpportunity[] {
  const $ = cheerio.load(html);
  const resolve = makeResolver(baseUrl);
  const items: RawOpportunity[] = [];

  $(".latest-jobs-section .material-card-content").each((_, node) => {
    const card = $(node);
    const title = cleanTitle(card.find(".material-card-title").first().text());
    if (title.length < 6 || ETEA_NOT_AN_OPENING.test(title)) return;

    const links = card.find("a[href]").toArray().map((anchor) => ({ label: $(anchor).text().replace(/\s+/g, " ").trim(), url: resolve($(anchor).attr("href") ?? "") }));
    const advertisement = links.find((link) => /advertisement/i.test(link.label))?.url;
    const apply = links.find((link) => /apply/i.test(link.label))?.url;
    if (!advertisement && !apply) return;

    const organization = title.replace(/\s*[-–]\s*\d{4}\s*$/, "").trim();
    items.push({
      title: `${title} (recruitment through ETEA)`,
      url: (advertisement ?? apply) as string,
      applyUrl: apply,
      kind: "job",
      scope: "pakistan",
      organization,
      summary: `Recruitment advertised by the Educational Testing & Evaluation Agency (ETEA) for ${organization}. The advertisement is an image or PDF: open it for the posts, qualifications and last date.`,
      location: "Khyber Pakhtunkhwa",
      tags: ["government job", "khyber pakhtunkhwa", "etea"],
      funding: "paid",
    });
  });
  return items;
}

export const eteaAdapter: Adapter = async ({ source, http }) => {
  const response = await http.getText(source.endpoint, { respectRobots: source.respectRobots });
  return parseEtea(response.text, response.url).slice(0, source.maxItems ?? 20);
};

