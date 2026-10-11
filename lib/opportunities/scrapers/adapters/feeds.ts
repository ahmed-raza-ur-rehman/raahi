import { toIsoDateTime } from "../../dates";
import { cleanTitle } from "../../text";
import type { OpportunityKind, RawOpportunity } from "../../types";
import { cheerio } from "../dom";
import { RobotsDisallowedError } from "../http";
import type { Adapter } from "../types";

// ─── RSS / Atom ───────────────────────────────────────────────────────────────

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  published?: string;
  categories: string[];
}

/** Parse RSS 2.0 or Atom into a flat list. Tolerates CDATA, namespaces and missing fields. */
export function parseFeed(xml: string): FeedItem[] {
  const $ = cheerio.load(xml, { xml: true });
  const items: FeedItem[] = [];

  $("item").each((_, node) => {
    const item = $(node);
    const link = item.children("link").first().text().trim() || item.children("guid").first().text().trim();
    const title = item.children("title").first().text();
    if (!link || !title) return;
    items.push({
      title,
      link,
      summary: item.children("description").first().text() || item.children("content\\:encoded").first().text(),
      published: item.children("pubDate").first().text() || item.children("dc\\:date").first().text() || undefined,
      categories: item.children("category").map((__, c) => $(c).text().trim()).get().filter(Boolean),
    });
  });

  $("entry").each((_, node) => {
    const entry = $(node);
    const links = entry.children("link").toArray().map((l) => ({ href: $(l).attr("href"), rel: $(l).attr("rel") }));
    const link = (links.find((l) => l.rel === "alternate" || !l.rel) ?? links[0])?.href;
    const title = entry.children("title").first().text();
    if (!link || !title) return;
    items.push({
      title,
      link,
      summary: entry.children("summary").first().text() || entry.children("content").first().text(),
      published: entry.children("published").first().text() || entry.children("updated").first().text() || undefined,
      categories: entry.children("category").map((__, c) => $(c).attr("term") ?? $(c).text()).get().filter(Boolean),
    });
  });

  return items;
}

function feedItemToRaw(item: FeedItem): RawOpportunity {
  return {
    title: item.title,
    url: item.link,
    summary: item.summary,
    postedAt: item.published ? toIsoDateTime(item.published) : undefined,
    tags: item.categories,
    kind: kindFromCategories(item.categories),
  };
}

export const rssAdapter: Adapter = async ({ source, http }) => {
  const response = await http.getText(source.endpoint, { accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5", respectRobots: source.respectRobots });
  return parseFeed(response.text).slice(0, source.maxItems ?? 60).map(feedItemToRaw);
};

// ─── WordPress REST API ───────────────────────────────────────────────────────

const KIND_PRIORITY: Array<[RegExp, OpportunityKind]> = [
  [/internship|traineeship/i, "internship"],
  [/fellowship/i, "fellowship"],
  [/scholarship|bursary|financial aid/i, "scholarship"],
  [/competition|contest|hackathon|award|prize|olympiad/i, "competition"],
  [/grant|funding|call for proposals/i, "grant"],
  [/\bjobs?\b|vacanc|career|recruit/i, "job"],
  [/training|workshop|course|webinar|conference/i, "training"],
];

/** The site's own category names are a better classifier than guessing from the title. */
export function kindFromCategories(names: string[]): OpportunityKind | undefined {
  const text = names.join(" | ");
  return KIND_PRIORITY.find(([pattern]) => pattern.test(text))?.[1];
}

interface WpPost {
  id?: number;
  date?: string;
  date_gmt?: string;
  link?: string;
  title?: { rendered?: string };
  excerpt?: { rendered?: string };
  categories?: number[];
}

const GENERIC_CATEGORIES = /^(uncategori[sz]ed|featured|news|blog|home|other|all)$/i;

export function parseWordPressPosts(json: unknown, categoryNames: Map<number, string> = new Map()): RawOpportunity[] {
  if (!Array.isArray(json)) return [];
  const results: RawOpportunity[] = [];
  for (const entry of json as WpPost[]) {
    const title = cleanTitle(entry.title?.rendered);
    const link = entry.link;
    if (!title || !link) continue;
    const names = (entry.categories ?? [])
      .map((id) => categoryNames.get(id))
      .filter((name): name is string => Boolean(name) && !GENERIC_CATEGORIES.test(name as string));
    const gmt = entry.date_gmt ? `${entry.date_gmt.replace(/Z$/, "")}Z` : undefined;
    results.push({
      title,
      url: link,
      summary: entry.excerpt?.rendered,
      postedAt: gmt ?? entry.date,
      tags: names.map(cleanTitle),
      kind: kindFromCategories(names),
    });
  }
  return results;
}

async function loadCategoryNames(
  base: string,
  ids: number[],
  getJson: (url: string) => Promise<unknown>,
): Promise<Map<number, string>> {
  const names = new Map<number, string>();
  for (let start = 0; start < ids.length && start < 200; start += 100) {
    const chunk = ids.slice(start, start + 100);
    try {
      const json = await getJson(`${base}/wp-json/wp/v2/categories?include=${chunk.join(",")}&per_page=100&_fields=id,name`);
      if (Array.isArray(json)) {
        for (const row of json as Array<{ id?: number; name?: string }>) {
          if (typeof row.id === "number" && row.name) names.set(row.id, row.name);
        }
      }
    } catch {
      // Category names are a nice-to-have; titles and excerpts still classify the post.
    }
  }
  return names;
}

export const wordpressAdapter: Adapter = async ({ source, http, log }) => {
  const base = source.endpoint.replace(/\/+$/, "");
  const perPage = Math.min(Math.max(source.maxItems ?? 40, 1), 100);
  const options = { respectRobots: source.respectRobots };

  try {
    const posts = await http.getJson<unknown>(
      `${base}/wp-json/wp/v2/posts?per_page=${perPage}&_fields=id,date_gmt,date,link,title,excerpt,categories`,
      options,
    );
    const ids = [...new Set((Array.isArray(posts) ? (posts as WpPost[]) : []).flatMap((post) => post.categories ?? []))];
    const names = ids.length > 0 ? await loadCategoryNames(base, ids, (url) => http.getJson<unknown>(url, options)) : new Map();
    const parsed = parseWordPressPosts(posts, names);
    if (parsed.length > 0) return parsed;
    log("WordPress REST API returned no posts; trying the RSS feed");
  } catch (error) {
    if (error instanceof RobotsDisallowedError) throw error;
    log(`WordPress REST API unavailable (${error instanceof Error ? error.message : "error"}); trying the RSS feed`);
  }

  const feed = await http.getText(`${base}/feed/`, { accept: "application/rss+xml,application/xml;q=0.9,*/*;q=0.5", respectRobots: source.respectRobots });
  return parseFeed(feed.text).slice(0, perPage).map(feedItemToRaw);
};
