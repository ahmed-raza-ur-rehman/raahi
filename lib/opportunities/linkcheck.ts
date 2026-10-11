import { USER_AGENT } from "./scrapers/http";
import type { LinkHealthEntry, Resource } from "./types";

/**
 * Link-health checker for the directory. A site that refuses bots (403/429) is "blocked", and a site that does
 * not answer at all (timeout, TLS or DNS failure) is "unreachable": the first live run from GitHub's servers
 * showed that many .gov.pk sites do exactly that to non-Pakistani networks while working fine in Pakistan, so
 * neither is called broken. Only a page that is gone (404/410) or a server error (5xx) is "broken".
 * Run weekly by the scheduled workflow; results are merged into /api/resources.
 */

export interface LinkCheckOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  hostDelayMs?: number;
  concurrency?: number;
  now?: Date;
  sleep?: (ms: number) => Promise<void>;
}

const BLOCKED = new Set([401, 403, 406, 412, 429, 451, 999]);

export function classify(status: number): LinkHealthEntry["verdict"] {
  if (status >= 200 && status < 400) return "ok";
  if (BLOCKED.has(status)) return "blocked";
  return "broken";
}

export async function checkLink(url: string, options: LinkCheckOptions = {}): Promise<LinkHealthEntry> {
  const doFetch = options.fetchImpl ?? fetch;
  const checkedAt = (options.now ?? new Date()).toISOString();
  const attempt = async (method: "HEAD" | "GET") =>
    doFetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs ?? 15_000),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.5" },
    });
  try {
    let response = await attempt("HEAD");
    // Some servers reject HEAD; confirm with a GET before judging the link.
    if (response.status === 405 || response.status === 501 || response.status >= 400) response = await attempt("GET");
    const verdict = classify(response.status);
    return { ok: verdict === "ok", status: response.status, verdict, finalUrl: response.url && response.url !== url ? response.url : undefined, checkedAt };
  } catch {
    return { ok: false, status: 0, verdict: "unreachable", checkedAt };
  }
}

export async function checkResources(resources: Resource[], options: LinkCheckOptions = {}): Promise<Record<string, LinkHealthEntry>> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const results: Record<string, LinkHealthEntry> = {};
  const lastByHost = new Map<string, number>();
  const queue = [...resources];

  const worker = async () => {
    for (let resource = queue.shift(); resource; resource = queue.shift()) {
      const host = new URL(resource.url).host;
      const wait = (lastByHost.get(host) ?? 0) + (options.hostDelayMs ?? 1000) - Date.now();
      lastByHost.set(host, Math.max(Date.now(), (lastByHost.get(host) ?? 0) + (options.hostDelayMs ?? 1000)));
      if (wait > 0) await sleep(wait);
      results[resource.id] = await checkLink(resource.url, options);
    }
  };
  await Promise.all(Array.from({ length: options.concurrency ?? 4 }, worker));
  return results;
}
