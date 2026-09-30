import { createHash } from "node:crypto";

import { getSqlite } from "@/lib/db/client";
import { searchKnowledge } from "@/lib/knowledge";
import type { KnowledgeHit, WebSearchResult } from "@/lib/types";
import { buildOfficialQuery, isOfficialDomain, officialSourcesFor, publisherName } from "./dorking";
import { crawl, fetchPage } from "./scraper";

/**
 * Search orchestration.
 *
 * Three layers, always in this order so the citizen gets an answer even when
 * there is no network, no search provider and no API key:
 *   1. Verified local knowledge (instant, zero network cost).
 *   2. Cached web results (zero network cost).
 *   3. Live search, only when a provider key is configured AND the per-minute
 *      budget allows it.
 */

export interface WebSearchOptions {
  /** Restrict live crawling to these hosts. */
  sites?: string[];
  limit?: number;
  /** Allow network calls. When false, only layers 1–2 run. */
  live?: boolean;
  topic?: string;
}

/* ── Provider adapters ── */

type ProviderName = "brave" | "serper" | "google_cse";

function configuredProvider(): { name: ProviderName; key: string; cx?: string } | undefined {
  if (process.env.BRAVE_SEARCH_API_KEY) return { name: "brave", key: process.env.BRAVE_SEARCH_API_KEY };
  if (process.env.SERPER_API_KEY) return { name: "serper", key: process.env.SERPER_API_KEY };
  if (process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) {
    return { name: "google_cse", key: process.env.GOOGLE_CSE_API_KEY, cx: process.env.GOOGLE_CSE_CX };
  }
  return undefined;
}

/** Per-minute live-search budget so a burst of users cannot exhaust the quota. */
const LIVE_BUDGET_PER_MINUTE = Number(process.env.RAAHI_LIVE_SEARCH_BUDGET ?? 12);
let windowStart = Date.now();
let windowUsed = 0;

function budgetAvailable(): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    windowUsed = 0;
  }
  return windowUsed < LIVE_BUDGET_PER_MINUTE;
}

function spendBudget() {
  windowUsed += 1;
}

export function liveSearchStatus() {
  return {
    provider: configuredProvider()?.name ?? null,
    budgetPerMinute: LIVE_BUDGET_PER_MINUTE,
    usedThisMinute: windowUsed,
    remaining: Math.max(0, LIVE_BUDGET_PER_MINUTE - windowUsed),
  };
}

async function providerSearch(query: string, limit: number): Promise<WebSearchResult[]> {
  const provider = configuredProvider();
  if (!provider) return [];

  try {
    if (provider.name === "brave") {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`;
      const response = await fetch(url, { headers: { "X-Subscription-Token": provider.key, Accept: "application/json" } });
      if (!response.ok) return [];
      const data = (await response.json()) as { web?: { results?: { title: string; url: string; description?: string }[] } };
      return (data.web?.results ?? []).map((item) => normalizeResult(item.title, item.url, item.description ?? ""));
    }

    if (provider.name === "serper") {
      const response = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": provider.key, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: limit }),
      });
      if (!response.ok) return [];
      const data = (await response.json()) as { organic?: { title: string; link: string; snippet?: string }[] };
      return (data.organic ?? []).map((item) => normalizeResult(item.title, item.link, item.snippet ?? ""));
    }

    const url = `https://www.googleapis.com/customsearch/v1?key=${provider.key}&cx=${provider.cx}&q=${encodeURIComponent(query)}&num=${limit}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = (await response.json()) as { items?: { title: string; link: string; snippet?: string }[] };
    return (data.items ?? []).map((item) => normalizeResult(item.title, item.link, item.snippet ?? ""));
  } catch {
    return [];
  }
}

function normalizeResult(title: string, url: string, snippet: string): WebSearchResult {
  let host = "";
  try {
    host = new URL(url).host.replace(/^www\./, "");
  } catch {
    host = "";
  }
  const official = isOfficialDomain(host);
  return {
    title: title.replace(/<[^>]+>/g, "").trim(),
    url,
    snippet: snippet.replace(/<[^>]+>/g, "").trim().slice(0, 400),
    source: publisherName(host) ?? host,
    official,
    score: official ? 1 : 0.45,
  };
}

/* ── Cache ── */

function hashQuery(value: string): string {
  return createHash("sha1").update(value.toLowerCase().trim()).digest("hex");
}

function readSearchCache(query: string): WebSearchResult[] | undefined {
  const row = getSqlite()
    .prepare("SELECT results, expires_at FROM web_search_cache WHERE query_hash = ?")
    .get(hashQuery(query)) as { results: string; expires_at: string } | undefined;
  if (!row) return undefined;
  if (Date.parse(row.expires_at) < Date.now()) return undefined;
  try {
    return JSON.parse(row.results) as WebSearchResult[];
  } catch {
    return undefined;
  }
}

function writeSearchCache(query: string, results: WebSearchResult[], minutes = 180) {
  getSqlite()
    .prepare(
      `INSERT OR REPLACE INTO web_search_cache (query_hash, query, results, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(hashQuery(query), query, JSON.stringify(results), new Date().toISOString(), new Date(Date.now() + minutes * 60_000).toISOString());
}

/* ── Public API ── */

export interface UnifiedSearchResponse {
  query: string;
  knowledge: KnowledgeHit[];
  web: WebSearchResult[];
  pages: { url: string; title: string; excerpt: string; fromCache: boolean }[];
  meta: {
    provider: string | null;
    fromCache: boolean;
    liveAllowed: boolean;
    budget: ReturnType<typeof liveSearchStatus>;
    note?: string;
  };
}

export async function unifiedSearch(query: string, options: WebSearchOptions = {}): Promise<UnifiedSearchResponse> {
  const limit = options.limit ?? 6;
  const knowledge = searchKnowledge({ query, limit });

  const cached = readSearchCache(query);
  const provider = configuredProvider();
  const liveAllowed = options.live !== false && Boolean(provider) && budgetAvailable();

  let web = cached ?? [];
  const fromCache = Boolean(cached);
  let note: string | undefined;

  if (!cached) {
    if (provider && options.live !== false) {
      if (budgetAvailable()) {
        spendBudget();
        web = await providerSearch(query, limit);
        writeSearchCache(query, web);
      } else {
        note = "Live search is pacing itself to protect the quota. Verified knowledge results are shown below.";
      }
    } else {
      const suggestions = officialSourcesFor(options.topic ?? query);
      web = suggestions.map((entry) => ({
        title: `${entry.name} — official source`,
        url: `https://${entry.domain}/`,
        snippet: `Search this publisher for: ${entry.query}`,
        source: entry.name,
        official: true,
        score: 0.9,
      }));
      note = "No live search provider is configured, so RAAHI points you at the official publishers and its verified knowledge base instead.";
      writeSearchCache(query, web, 60);
    }
  }

  /* Fetch the top official pages when live mode is on, within the crawl budget. */
  const pages: UnifiedSearchResponse["pages"] = [];
  if (options.live !== false && web.length > 0) {
    const candidates = web
      .filter((result) => result.official)
      .slice(0, 2)
      .map((result) => result.url);
    if (candidates.length > 0) {
      const crawled = await crawl(candidates, { maxPages: 2, maxBytesPerPage: 120_000 });
      for (const page of crawled.pages) {
        if (!page.text) continue;
        pages.push({
          url: page.url,
          title: page.title,
          excerpt: page.text.slice(0, 600),
          fromCache: page.fromCache,
        });
      }
    }
  }

  return {
    query,
    knowledge,
    web: [...web].sort((left, right) => right.score - left.score).slice(0, limit),
    pages,
    meta: { provider: provider?.name ?? null, fromCache, liveAllowed, budget: liveSearchStatus(), ...(note ? { note } : {}) },
  };
}

/**
 * Look for fresh official information about a topic: builds publisher-restricted
 * operator queries, then reads the matching pages politely.
 */
export async function discoverOfficialUpdates(topic: string, sites: string[] = []) {
  const sources = sites.length > 0 ? sites : officialSourcesFor(topic).map((entry) => entry.domain);
  const queries = {
    notification: buildOfficialQuery("notification", topic, sources),
    dates: buildOfficialQuery("dates", topic, sources),
    advertisement: buildOfficialQuery("advertisement", topic, sources),
  };

  const targets = sources.slice(0, 3).map((domain) => `https://${domain}/`);
  const crawled = await crawl(targets, { maxPages: 3, maxBytesPerPage: 120_000 });

  const knowledge = searchKnowledge({ query: topic, limit: 4 });

  return {
    topic,
    queries,
    pages: crawled.pages.map((page) => ({
      url: page.url,
      title: page.title,
      excerpt: page.text.slice(0, 500),
      fromCache: page.fromCache,
      ...(page.note ? { note: page.note } : {}),
    })),
    knowledge,
    budget: crawled.budget,
  };
}

/** Fetch one page explicitly (used by the "open and check" action). */
export async function inspectPage(url: string) {
  return fetchPage(url, { maxBytes: 250_000 });
}
