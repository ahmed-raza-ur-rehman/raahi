import { KIND_LABELS } from "./i18n";
import type { OpportunityKind, OpportunityQuery, OpportunityView } from "./types";

/**
 * Subscribable versions of any search: RSS 2.0, Atom 1.0 and JSON Feed 1.1. Every entry links to RAAHI's own page for
 * the listing (which carries the official link, the deadline and the guidance) and names the source it came from; the
 * original link is also given (`external_url` in JSON Feed, a `related` link in Atom).
 */

export type FeedFormat = "rss" | "atom" | "json";

export interface FeedMeta {
  title: string;
  description: string;
  /** Public origin of this site, e.g. https://raahi.example (no trailing slash). */
  origin: string;
  /** The page a person would open to see the same search. */
  homeUrl: string;
  /** This feed's own address. */
  selfUrl: string;
  updated: Date;
}

// XML 1.0 forbids most control characters; sources occasionally contain them.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function xmlEscape(value: string): string {
  return value.replace(CONTROL, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function pageUrl(origin: string, item: Pick<OpportunityView, "id">): string {
  return `${origin}/opportunities/${item.id}`;
}

function publishedAt(item: OpportunityView): Date {
  return new Date(item.postedAt ?? item.firstSeen);
}

/** Short plain-text description: what it is, who runs it, when it closes, and where it came from. */
export function itemDescription(item: OpportunityView): string {
  const facts: string[] = [KIND_LABELS[item.kind].en];
  if (item.organization) facts.push(item.organization);
  if (item.country) facts.push(item.country);
  if (item.deadline) facts.push(`Deadline: ${item.deadline}`);
  else if (item.status === "rolling") facts.push("Rolling applications");
  if (item.openToPakistan === false) facts.push("May not be open to applicants in Pakistan");
  const head = `${facts.join(" · ")}.`;
  const body = item.summary ? ` ${item.summary.replace(/\s+/g, " ").slice(0, 280)}` : "";
  return `${head}${body} Listed via ${item.sourceName}; confirm details on the official page.`;
}

export function buildRss(items: OpportunityView[], meta: FeedMeta): string {
  const entries = items.map((item) => {
    const link = pageUrl(meta.origin, item);
    const categories = [KIND_LABELS[item.kind].en, item.country, ...item.tags.slice(0, 3)].filter((value): value is string => Boolean(value));
    return [
      "    <item>",
      `      <title>${xmlEscape(item.title)}</title>`,
      `      <link>${xmlEscape(link)}</link>`,
      `      <guid isPermaLink="true">${xmlEscape(link)}</guid>`,
      `      <pubDate>${publishedAt(item).toUTCString()}</pubDate>`,
      ...categories.map((category) => `      <category>${xmlEscape(category)}</category>`),
      `      <description>${xmlEscape(itemDescription(item))}</description>`,
      `      <source url="${xmlEscape(item.sourceUrl ?? meta.origin)}">${xmlEscape(item.sourceName)}</source>`,
      "    </item>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlEscape(meta.title)}</title>`,
    `    <link>${xmlEscape(meta.homeUrl)}</link>`,
    `    <description>${xmlEscape(meta.description)}</description>`,
    "    <language>en</language>",
    `    <lastBuildDate>${meta.updated.toUTCString()}</lastBuildDate>`,
    "    <ttl>60</ttl>",
    `    <atom:link href="${xmlEscape(meta.selfUrl)}" rel="self" type="application/rss+xml"/>`,
    ...entries,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function buildAtom(items: OpportunityView[], meta: FeedMeta): string {
  const entries = items.map((item) => {
    const link = pageUrl(meta.origin, item);
    return [
      "  <entry>",
      `    <id>${xmlEscape(link)}</id>`,
      `    <title>${xmlEscape(item.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${xmlEscape(link)}"/>`,
      `    <link rel="related" type="text/html" href="${xmlEscape(item.url)}" title="Original listing"/>`,
      `    <published>${publishedAt(item).toISOString()}</published>`,
      `    <updated>${new Date(item.lastSeen).toISOString()}</updated>`,
      `    <author><name>${xmlEscape(item.sourceName)}</name></author>`,
      `    <category term="${xmlEscape(item.kind)}" label="${xmlEscape(KIND_LABELS[item.kind].en)}"/>`,
      `    <summary type="text">${xmlEscape(itemDescription(item))}</summary>`,
      "  </entry>",
    ].join("\n");
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `  <id>${xmlEscape(meta.selfUrl)}</id>`,
    `  <title>${xmlEscape(meta.title)}</title>`,
    `  <subtitle>${xmlEscape(meta.description)}</subtitle>`,
    `  <updated>${meta.updated.toISOString()}</updated>`,
    `  <link rel="self" type="application/atom+xml" href="${xmlEscape(meta.selfUrl)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xmlEscape(meta.homeUrl)}"/>`,
    "  <author><name>RAAHI</name></author>",
    ...entries,
    "</feed>",
    "",
  ].join("\n");
}

export function buildJsonFeed(items: OpportunityView[], meta: FeedMeta): Record<string, unknown> {
  return {
    version: "https://jsonfeed.org/version/1.1",
    title: meta.title,
    description: meta.description,
    home_page_url: meta.homeUrl,
    feed_url: meta.selfUrl,
    language: "en",
    items: items.map((item) => ({
      id: item.id,
      url: pageUrl(meta.origin, item),
      external_url: item.url,
      title: item.title,
      content_text: itemDescription(item),
      date_published: publishedAt(item).toISOString(),
      date_modified: new Date(item.lastSeen).toISOString(),
      tags: [item.kind, ...(item.country ? [item.country] : []), ...item.tags.slice(0, 3)],
      authors: [{ name: item.sourceName, url: item.sourceUrl }],
      _raahi: { kind: item.kind, scope: item.scope, deadline: item.deadline ?? null, daysLeft: item.daysLeft, openToPakistan: item.openToPakistan ?? null, source: item.sourceId },
    })),
  };
}

export const FEED_CONTENT_TYPE: Record<FeedFormat, string> = {
  rss: "application/rss+xml; charset=utf-8",
  atom: "application/atom+xml; charset=utf-8",
  json: "application/feed+json; charset=utf-8",
};

/** A readable name for a search, used as the feed title ("Scholarships · Germany · closing within 14 days"). */
export function describeQuery(query: OpportunityQuery): string {
  const parts: string[] = [];
  if (query.kinds && query.kinds.length > 0) parts.push(query.kinds.map((kind: OpportunityKind) => `${KIND_LABELS[kind].en}s`).join(" / "));
  if (query.q) parts.push(`“${query.q}”`);
  if (query.country) parts.push(query.country);
  if (query.scope) parts.push(query.scope === "pakistan" ? "in Pakistan" : "abroad & remote");
  if (query.level) parts.push(query.level);
  if (query.funding) parts.push(`${query.funding} funding`);
  if (query.remote) parts.push("remote");
  if (query.deadlineWithinDays) parts.push(`closing within ${query.deadlineWithinDays} days`);
  return parts.length > 0 ? parts.join(" · ") : "All opportunities";
}

/** Origin as the visitor sees it, including behind a proxy such as Vercel's. */
export function siteOrigin(request: Request): string {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
