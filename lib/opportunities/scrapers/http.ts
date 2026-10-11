import { crawlDelay, isAllowed, parseRobots, type RobotsRules } from "./robots";

/**
 * Polite HTTP client for the scrapers.
 *
 * Principles (deliberately conservative — RAAHI is a public-interest project):
 *  - identify honestly (no browser User-Agent spoofing, no header tricks to dodge blocks);
 *  - obey robots.txt (a 5xx/unreachable robots.txt is treated as "do not crawl" for this run);
 *  - space requests to the same host, back off on 429/5xx, never hammer;
 *  - cap response size and time;
 *  - if a site refuses us, we give up on it rather than work around it.
 */

export const ROBOTS_TOKEN = "RAAHI-OpportunityBot";
export const USER_AGENT = `${ROBOTS_TOKEN}/1.0 (+https://github.com/ahmed-raza-ur-rehman/raahi; opportunity aggregator for Pakistani students and job seekers)`;

export class RobotsDisallowedError extends Error {
  constructor(public readonly url: string) {
    super(`robots.txt disallows fetching ${url}`);
    this.name = "RobotsDisallowedError";
  }
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly url: string,
    message?: string,
  ) {
    super(message ?? `HTTP ${status} for ${url}`);
    this.name = "HttpError";
  }
}

export interface HttpClientOptions {
  timeoutMs?: number;
  retries?: number;
  /** Minimum gap between request starts to the same host. */
  hostDelayMs?: number;
  maxBytes?: number;
  userAgent?: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  accept?: string;
  headers?: Record<string, string>;
  /** Default true. Set false only for documented public APIs that publish their own terms. */
  respectRobots?: boolean;
  signal?: AbortSignal;
}

export interface TextResponse {
  status: number;
  url: string;
  text: string;
  contentType: string;
}

export interface HttpClient {
  getText(url: string, options?: RequestOptions): Promise<TextResponse>;
  getJson<T = unknown>(url: string, options?: RequestOptions): Promise<T>;
}

type RobotsEntry = { kind: "rules"; rules: RobotsRules } | { kind: "allow-all" } | { kind: "deny-all"; reason: string };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const RETRYABLE = new Set([429, 502, 503, 504]);

export function createHttpClient(options: HttpClientOptions = {}): HttpClient {
  const timeoutMs = options.timeoutMs ?? 20_000;
  const retries = options.retries ?? 2;
  const hostDelayMs = options.hostDelayMs ?? 1_000;
  const maxBytes = options.maxBytes ?? 15 * 1024 * 1024;
  const userAgent = options.userAgent ?? USER_AGENT;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  const gates = new Map<string, Promise<void>>();
  const lastStart = new Map<string, number>();
  const robotsCache = new Map<string, Promise<RobotsEntry>>();
  const hostDelays = new Map<string, number>();

  async function acquire(host: string) {
    const previous = gates.get(host) ?? Promise.resolve();
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = resolve;
    });
    gates.set(host, previous.then(() => next));
    await previous;
    const gap = Math.max(hostDelayMs, hostDelays.get(host) ?? 0);
    const wait = Math.max(0, (lastStart.get(host) ?? 0) + gap - Date.now());
    if (wait > 0) await sleep(wait);
    lastStart.set(host, Date.now());
    release();
  }

  async function rawFetch(url: string, request: RequestOptions, accept: string): Promise<Response> {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (request.signal) signals.push(request.signal);
    return doFetch(url, {
      redirect: "follow",
      signal: AbortSignal.any(signals),
      headers: {
        "User-Agent": userAgent,
        Accept: request.accept ?? accept,
        "Accept-Language": "en",
        ...request.headers,
      },
    });
  }

  async function loadRobots(origin: string, request: RequestOptions): Promise<RobotsEntry> {
    try {
      await acquire(new URL(origin).host);
      const response = await rawFetch(`${origin}/robots.txt`, request, "text/plain");
      if (response.status >= 500) return { kind: "deny-all", reason: `robots.txt returned HTTP ${response.status}` };
      if (!response.ok) return { kind: "allow-all" }; // 4xx: no robots file → no restrictions
      const rules = parseRobots((await response.text()).slice(0, 512 * 1024));
      const delay = crawlDelay(rules, userAgent);
      if (delay && delay > 0) hostDelays.set(new URL(origin).host, Math.min(delay, 30) * 1000);
      return { kind: "rules", rules };
    } catch (error) {
      return { kind: "deny-all", reason: `robots.txt unreachable (${error instanceof Error ? error.message : "error"})` };
    }
  }

  async function checkRobots(url: string, request: RequestOptions) {
    const parsed = new URL(url);
    let entry = robotsCache.get(parsed.origin);
    if (!entry) {
      entry = loadRobots(parsed.origin, request);
      robotsCache.set(parsed.origin, entry);
    }
    const resolved = await entry;
    if (resolved.kind === "deny-all") throw new HttpError(0, url, `Skipped: ${resolved.reason}`);
    if (resolved.kind === "rules" && !isAllowed(resolved.rules, ROBOTS_TOKEN, `${parsed.pathname}${parsed.search}`)) {
      throw new RobotsDisallowedError(url);
    }
  }

  async function getText(url: string, request: RequestOptions = {}): Promise<TextResponse> {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new HttpError(0, url, "Unsupported protocol");
    if (request.respectRobots !== false) await checkRobots(url, request);

    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        await acquire(parsed.host);
        const response = await rawFetch(url, request, "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5");
        if (RETRYABLE.has(response.status) && attempt < retries) {
          const retryAfter = Number(response.headers.get("retry-after"));
          const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 800 * 2 ** attempt;
          await sleep(backoff);
          lastError = new HttpError(response.status, url);
          continue;
        }
        if (!response.ok) throw new HttpError(response.status, url);
        const declared = Number(response.headers.get("content-length"));
        if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(response.status, url, `Response too large (${declared} bytes)`);
        const text = await response.text();
        if (text.length > maxBytes) throw new HttpError(response.status, url, "Response too large");
        return { status: response.status, url: response.url || url, text, contentType: response.headers.get("content-type") ?? "" };
      } catch (error) {
        if (error instanceof HttpError && !RETRYABLE.has(error.status)) throw error;
        lastError = error;
        if (attempt < retries) await sleep(800 * 2 ** attempt);
      }
    }
    if (lastError instanceof Error) throw lastError;
    throw new HttpError(0, url, "Request failed");
  }

  async function getJson<T = unknown>(url: string, request: RequestOptions = {}): Promise<T> {
    const response = await getText(url, { accept: "application/json", ...request });
    try {
      return JSON.parse(response.text) as T;
    } catch {
      throw new HttpError(response.status, url, `Expected JSON but received ${response.contentType || "unknown content"}`);
    }
  }

  return { getText, getJson };
}
