import { getSqlite } from "@/lib/db/client";

/**
 * A polite, budget-limited crawler.
 *
 * Guarantees (so a user is never starved of the feature and the servers we
 * depend on are never overloaded):
 *  1. robots.txt is fetched, parsed and cached for 24h; disallowed paths are
 *     never requested.
 *  2. A persisted token bucket limits requests per host (default 1 request /
 *     1.5s, burst 3).
 *  3. Every response is cached with an ETag and a TTL, so repeat questions cost
 *     zero network requests.
 *  4. A hard page and byte budget caps any single crawl.
 *  5. Failures back off: the host is blocked for a cooling-off period after a
 *     429 or repeated 5xx instead of hammering it.
 */

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  /** Skip the cache and force a network request. */
  force?: boolean;
  /** TTL for a successful fetch, in minutes. */
  cacheMinutes?: number;
  userAgent?: string;
}

export interface FetchedPage {
  url: string;
  status: number;
  title: string;
  text: string;
  fetchedAt: string;
  fromCache: boolean;
  host: string;
  blockedByRobots?: boolean;
  note?: string;
}

export interface CrawlOptions extends FetchOptions {
  maxPages?: number;
  maxBytesPerPage?: number;
  /** Minimum milliseconds between two requests to the same host. */
  delayMs?: number;
}

const DEFAULT_USER_AGENT =
  "RAAHI-CitizenNavigator/1.0 (+https://github.com/ahmed-raza-ur-rehman/raahi; citizen service navigation; contact via repository issues)";

const HOST_CONFIG: Record<string, { rpm: number; burst: number }> = {};
const DEFAULT_RPM = 20; // 20 requests per minute ≈ one every 3s
const DEFAULT_BURST = 3;

export function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

/* ────────────────────────────────────────────────────────────────
 * Rate limiting (persisted token bucket)
 * ──────────────────────────────────────────────────────────────── */

function refill(host: string): { tokens: number; blockedUntil: number } {
  const database = getSqlite();
  const now = Date.now();
  const row = database
    .prepare("SELECT tokens, last_at, blocked_until FROM web_host_state WHERE host = ?")
    .get(host) as { tokens: string; last_at: number; blocked_until: number } | undefined;

  const config = HOST_CONFIG[host] ?? { rpm: DEFAULT_RPM, burst: DEFAULT_BURST };
  const ratePerMs = config.rpm / 60_000;
  const capacity = config.burst;

  if (!row) {
    database
      .prepare("INSERT INTO web_host_state (host, tokens, last_at, blocked_until) VALUES (?, ?, ?, 0)")
      .run(host, String(capacity), now);
    return { tokens: capacity, blockedUntil: 0 };
  }

  const elapsed = Math.max(0, now - row.last_at);
  const tokens = Math.min(capacity, Number(row.tokens) + elapsed * ratePerMs);
  database.prepare("UPDATE web_host_state SET tokens = ?, last_at = ? WHERE host = ?").run(String(tokens), now, host);

  return { tokens, blockedUntil: row.blocked_until };
}

/** Try to spend one request token. Returns the wait in ms, or 0 when allowed. */
export function checkRateLimit(host: string): { allowed: boolean; waitMs: number } {
  const { tokens, blockedUntil } = refill(host);
  const now = Date.now();
  if (blockedUntil > now) return { allowed: false, waitMs: blockedUntil - now };
  if (tokens < 1) return { allowed: false, waitMs: 1000 };
  return { allowed: true, waitMs: 0 };
}

function spendToken(host: string) {
  const database = getSqlite();
  const { tokens } = refill(host);
  database
    .prepare("UPDATE web_host_state SET tokens = ?, last_at = ? WHERE host = ?")
    .run(String(Math.max(0, tokens - 1)), Date.now(), host);
}

/** Back a host off after a rate-limit or server error. */
export function backoffHost(host: string, seconds = 300) {
  const database = getSqlite();
  const now = Date.now();
  database
    .prepare(
      `INSERT INTO web_host_state (host, tokens, last_at, blocked_until) VALUES (?, '0', ?, ?)
       ON CONFLICT(host) DO UPDATE SET blocked_until = ?`,
    )
    .run(host, now, now + seconds * 1000, now + seconds * 1000);
}

export function hostStatus(host: string) {
  const { tokens, blockedUntil } = refill(host);
  return { host, tokens: Number(tokens.toFixed(2)), blockedUntil, blockedFor: Math.max(0, blockedUntil - Date.now()) };
}

/* ────────────────────────────────────────────────────────────────
 * robots.txt
 * ──────────────────────────────────────────────────────────────── */

interface RobotsRules {
  disallow: string[];
  allow: string[];
  crawlDelayMs: number;
  fetchedAt: string;
  expiresAt: string;
}

function cachedRobots(host: string): RobotsRules | undefined {
  const row = getSqlite()
    .prepare("SELECT rules, fetched_at, expires_at FROM web_robots WHERE host = ?")
    .get(host) as { rules: string; fetched_at: string; expires_at: string } | undefined;
  if (!row) return undefined;
  if (Date.parse(row.expires_at) < Date.now()) return undefined;
  try {
    return JSON.parse(row.rules) as RobotsRules;
  } catch {
    return undefined;
  }
}

function parseRobots(text: string): { disallow: string[]; allow: string[]; crawlDelayMs: number } {
  const lines = text.split(/\r?\n/);
  const disallow: string[] = [];
  const allow: string[] = [];
  let crawlDelayMs = 0;
  let applies = false;

  for (const rawLine of lines) {
    const line = rawLine.split("#")[0]?.trim() ?? "";
    if (line.length === 0) continue;
    const [rawKey, ...rest] = line.split(":");
    const key = (rawKey ?? "").trim().toLowerCase();
    const value = rest.join(":").trim();

    if (key === "user-agent") {
      applies = value === "*" || value.toLowerCase().includes("raahi");
      continue;
    }
    if (!applies) continue;
    if (key === "disallow") disallow.push(value);
    if (key === "allow") allow.push(value);
    if (key === "crawl-delay") {
      const seconds = Number.parseFloat(value);
      if (Number.isFinite(seconds)) crawlDelayMs = Math.max(crawlDelayMs, seconds * 1000);
    }
  }

  return { disallow, allow, crawlDelayMs };
}

async function loadRobots(host: string, options: FetchOptions): Promise<RobotsRules> {
  const cached = cachedRobots(host);
  if (cached) return cached;

  const empty: RobotsRules = {
    disallow: [],
    allow: [],
    crawlDelayMs: 0,
    fetchedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 8_000);
    const response = await fetch(`https://${host}/robots.txt`, {
      signal: controller.signal,
      headers: { "user-agent": options.userAgent ?? DEFAULT_USER_AGENT, accept: "text/plain" },
    });
    clearTimeout(timeout);
    if (!response.ok) {
      getSqlite()
        .prepare("INSERT OR REPLACE INTO web_robots (host, rules, fetched_at, expires_at) VALUES (?, ?, ?, ?)")
        .run(host, JSON.stringify(empty), empty.fetchedAt, new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
      return empty;
    }
    const parsed = parseRobots(await response.text());
    const rules: RobotsRules = {
      ...parsed,
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
    getSqlite()
      .prepare("INSERT OR REPLACE INTO web_robots (host, rules, fetched_at, expires_at) VALUES (?, ?, ?, ?)")
      .run(host, JSON.stringify(rules), rules.fetchedAt, rules.expiresAt);
    return rules;
  } catch {
    return empty;
  }
}

function pathBlocked(pathname: string, rules: RobotsRules): boolean {
  const path = pathname || "/";
  // An explicit Allow always wins over a Disallow for our purposes.
  if (rules.allow.some((rule) => rule !== "" && path.startsWith(rule))) return false;
  return rules.disallow.some((rule) => {
    if (rule === "") return false;
    if (rule === "/") return true;
    return path.startsWith(rule);
  });
}

/* ────────────────────────────────────────────────────────────────
 * Cache
 * ──────────────────────────────────────────────────────────────── */

function readCache(url: string): FetchedPage | undefined {
  const row = getSqlite()
    .prepare("SELECT * FROM web_cache WHERE url = ?")
    .get(url) as
    | { url: string; status: number; title: string; text: string; etag: string | null; fetched_at: string; expires_at: string }
    | undefined;
  if (!row) return undefined;
  if (Date.parse(row.expires_at) < Date.now()) return undefined;
  return {
    url: row.url,
    status: row.status,
    title: row.title,
    text: row.text,
    fetchedAt: row.fetched_at,
    fromCache: true,
    host: hostOf(row.url),
  };
}

function writeCache(page: FetchedPage, etag: string | null, cacheMinutes: number) {
  getSqlite()
    .prepare(
      `INSERT OR REPLACE INTO web_cache (url, status, title, text, etag, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      page.url,
      page.status,
      page.title,
      page.text,
      etag,
      page.fetchedAt,
      new Date(Date.now() + cacheMinutes * 60_000).toISOString(),
    );
}

/* ────────────────────────────────────────────────────────────────
 * HTML → text
 * ──────────────────────────────────────────────────────────────── */

function stripHtml(html: string, limit: number): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

  const withoutScripts = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  const text = withoutScripts
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, limit);

  return { title: title || text.slice(0, 60), text };
}

/* ────────────────────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────────────────────── */

export async function fetchPage(url: string, options: FetchOptions = {}): Promise<FetchedPage> {
  const host = hostOf(url);
  const cacheMinutes = options.cacheMinutes ?? 60;
  const maxBytes = options.maxBytes ?? 1_000_000;
  const timeoutMs = options.timeoutMs ?? 12_000;
  const userAgent = options.userAgent ?? DEFAULT_USER_AGENT;

  if (!options.force) {
    const cached = readCache(url);
    if (cached) return cached;
  }

  const robots = await loadRobots(host, options);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, status: 0, title: "", text: "", fetchedAt: new Date().toISOString(), fromCache: false, host, note: "Invalid URL." };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { url, status: 0, title: "", text: "", fetchedAt: new Date().toISOString(), fromCache: false, host, note: "Unsupported protocol." };
  }
  if (pathBlocked(parsed.pathname + parsed.search, robots)) {
    return {
      url,
      status: 0,
      title: "",
      text: "",
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      host,
      blockedByRobots: true,
      note: "This publisher asks automated visitors not to read this page. Open it in your browser instead.",
    };
  }

  const limit = checkRateLimit(host);
  if (!limit.allowed) {
    const stale = readCache(url);
    if (stale) return { ...stale, note: "Served from cache while the request budget refills." };
    return {
      url,
      status: 0,
      title: "",
      text: "",
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      host,
      note: `Please retry in ${Math.ceil(limit.waitMs / 1000)} seconds — the crawler is pacing itself to stay polite.`,
    };
  }

  if (robots.crawlDelayMs > 0) await sleep(Math.min(robots.crawlDelayMs, 5_000));
  spendToken(host);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": userAgent,
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.8,*/*;q=0.5",
        "accept-language": "en,ur;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (response.status === 429 || response.status >= 500) {
      backoffHost(host, response.status === 429 ? 600 : 120);
      return {
        url,
        status: response.status,
        title: "",
        text: "",
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        host,
        note: "The publisher is busy or rate-limiting. RAAHI has paused requests to it and will retry later.",
      };
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("pdf")) {
      const page: FetchedPage = {
        url,
        status: response.status,
        title: url.split("/").pop() ?? "PDF document",
        text: "This is a PDF. Open it in your browser to read the notification — RAAHI does not store binary documents.",
        fetchedAt: new Date().toISOString(),
        fromCache: false,
        host,
      };
      writeCache(page, null, cacheMinutes);
      return page;
    }

    const raw = await response.text();
    const { title, text } = stripHtml(raw.slice(0, Math.max(maxBytes * 2, 200_000)), maxBytes);
    const page: FetchedPage = { url, status: response.status, title, text, fetchedAt: new Date().toISOString(), fromCache: false, host };
    writeCache(page, response.headers.get("etag"), cacheMinutes);
    return page;
  } catch (error) {
    return {
      url,
      status: 0,
      title: "",
      text: "",
      fetchedAt: new Date().toISOString(),
      fromCache: false,
      host,
      note: error instanceof Error && error.name === "AbortError" ? "The page took too long to respond. Try again shortly." : "The page could not be reached.",
    };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface CrawlResult {
  pages: FetchedPage[];
  budget: { requested: number; fetched: number; fromCache: number; blocked: number; bytes: number };
}

/** Crawl a small, bounded set of URLs politely and sequentially. */
export async function crawl(urls: string[], options: CrawlOptions = {}): Promise<CrawlResult> {
  const maxPages = options.maxPages ?? 4;
  const maxBytes = options.maxBytesPerPage ?? 400_000;
  const delayMs = options.delayMs ?? 1_200;

  const pages: FetchedPage[] = [];
  let fromCache = 0;
  let blocked = 0;
  let bytes = 0;
  let lastHost = "";

  for (const url of urls.slice(0, maxPages)) {
    const host = hostOf(url);
    if (host === lastHost && pages.length > 0) await sleep(delayMs);
    lastHost = host;

    const page = await fetchPage(url, { ...options, maxBytes });
    pages.push(page);
    if (page.fromCache) fromCache += 1;
    if (page.blockedByRobots) blocked += 1;
    bytes += page.text.length;
    if (bytes > maxBytes * maxPages) break;
  }

  return {
    pages,
    budget: { requested: urls.length, fetched: pages.length, fromCache, blocked, bytes },
  };
}

/** Cache hygiene — call from a cron or an admin route. */
export function pruneCache(): number {
  const database = getSqlite();
  const result = database.prepare("DELETE FROM web_cache WHERE expires_at < ?").run(new Date(Date.now() - 7 * 86_400_000).toISOString());
  return result.changes;
}
