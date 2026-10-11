import { dedupeOpportunities } from "../dedupe";
import { normalizeAll } from "../normalize";
import type { Opportunity, Snapshot, SourceReport } from "../types";
import { ADAPTERS } from "./adapters";
import { createHttpClient, RobotsDisallowedError, type HttpClient, type RequestOptions } from "./http";
import { mergeSnapshot, sortForDisplay } from "./merge";
import { SOURCES, authorityOf, retainHoursBySource } from "./sources";
import type { Adapter, AdapterId, SourceDefinition } from "./types";

export interface RunOptions {
  sources?: SourceDefinition[];
  /** Restrict the run to these source ids. */
  only?: string[];
  previous?: Snapshot;
  http?: HttpClient;
  now?: Date;
  /** Ignore each source's minimum interval. */
  force?: boolean;
  concurrency?: number;
  /** Per-source wall-clock budget. */
  sourceTimeoutMs?: number;
  adapters?: Partial<Record<AdapterId, Adapter>>;
  env?: Record<string, string | undefined>;
  /** The network this run is on (`pk` = a connection inside Pakistan). Defaults to `RAAHI_REGION`. */
  region?: string;
  onProgress?: (line: string) => void;
}

function withSignal(http: HttpClient, signal: AbortSignal): HttpClient {
  const merge = (options: RequestOptions | undefined): RequestOptions => ({ ...options, signal });
  return {
    getText: (url, options) => http.getText(url, merge(options)),
    getJson: (url, options) => http.getJson(url, merge(options)),
  };
}

function describeError(error: unknown): string {
  if (error instanceof RobotsDisallowedError) return `Blocked by robots.txt — skipped on purpose (${error.url})`;
  if (error instanceof DOMException && error.name === "TimeoutError") return "Timed out";
  if (error instanceof Error) return error.message.slice(0, 240);
  return "Unknown error";
}

async function runPool<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next;
      next += 1;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

interface SourceOutcome {
  report: SourceReport;
  items: Opportunity[];
  usable: boolean;
}

export async function runScrapers(options: RunOptions = {}): Promise<Snapshot> {
  const now = options.now ?? new Date();
  const registry = options.sources ?? SOURCES;
  const previous = options.previous;
  const http = options.http ?? createHttpClient();
  const env = options.env ?? process.env;
  const log = options.onProgress ?? (() => undefined);
  const region = options.region ?? env.RAAHI_REGION;
  const adapters = { ...ADAPTERS, ...options.adapters };
  const previousReports = new Map((previous?.sources ?? []).map((report) => [report.sourceId, report]));
  const previousCounts = new Map<string, number>();
  for (const item of previous?.items ?? []) previousCounts.set(item.sourceId, (previousCounts.get(item.sourceId) ?? 0) + 1);

  const selected = registry.filter((source) => !options.only || options.only.includes(source.id));

  const tasks = selected.map((source) => async (): Promise<SourceOutcome> => {
    const startedAt = new Date().toISOString();
    const base = { sourceId: source.id, name: source.name, startedAt, experimental: source.experimental };
    const before = previousReports.get(source.id);

    if (!source.enabled) {
      return { report: { ...base, status: "skipped", items: 0, durationMs: 0, note: source.disabledReason ?? "Disabled in the source registry", lastSuccessAt: before?.lastSuccessAt }, items: [], usable: false };
    }
    if (source.network && source.network !== region && !options.only?.includes(source.id)) {
      return {
        report: { ...base, status: "skipped", items: 0, durationMs: 0, note: "Needs a connection inside Pakistan (the site does not answer GitHub's servers). Run `npm run scrape:pk` from a Pakistani network.", lastSuccessAt: before?.lastSuccessAt },
        items: [],
        usable: false,
      };
    }
    const missingEnv = (source.requiresEnv ?? []).filter((name) => !env[name]);
    if (missingEnv.length > 0) {
      return { report: { ...base, status: "skipped", items: 0, durationMs: 0, note: `Needs environment variable ${missingEnv.join(", ")}`, lastSuccessAt: before?.lastSuccessAt }, items: [], usable: false };
    }
    if (!options.force && before?.lastSuccessAt) {
      const ageMinutes = (now.getTime() - Date.parse(before.lastSuccessAt)) / 60_000;
      if (ageMinutes >= 0 && ageMinutes < source.minIntervalMinutes) {
        return {
          report: { ...before, status: "skipped", note: `Fetched ${Math.round(ageMinutes)} min ago; minimum interval is ${source.minIntervalMinutes} min`, startedAt },
          items: [],
          usable: false,
        };
      }
    }

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new DOMException("Source timed out", "TimeoutError")), options.sourceTimeoutMs ?? 90_000);
    try {
      log(`→ ${source.id}`);
      const raw = await adapters[source.adapter]({
        source,
        http: withSignal(http, controller.signal),
        now,
        log: (message) => log(`  [${source.id}] ${message}`),
      });
      const { items, rejected } = normalizeAll(raw, { id: source.id, name: source.name, homepage: source.homepage, defaultKind: source.defaultKind, scope: source.scope }, now);
      const durationMs = Date.now() - started;
      const hadItemsBefore = (previousCounts.get(source.id) ?? 0) > 0;

      if (items.length === 0) {
        // A site that suddenly yields nothing has most likely changed its layout: do not trust it.
        return {
          report: {
            ...base,
            status: "empty",
            items: 0,
            durationMs,
            lastSuccessAt: before?.lastSuccessAt,
            note: hadItemsBefore
              ? "Returned no items although it did before — the page layout or API may have changed. Previous items are kept."
              : `No items parsed${rejected.length ? ` (${rejected.length} rejected: ${rejected[0].reason})` : ""}.`,
          },
          items: [],
          usable: !hadItemsBefore,
        };
      }
      return {
        report: {
          ...base,
          status: "ok",
          items: items.length,
          durationMs,
          lastSuccessAt: now.toISOString(),
          note: rejected.length > 0 ? `${rejected.length} entries rejected (e.g. ${rejected[0].reason})` : undefined,
        },
        items,
        usable: true,
      };
    } catch (error) {
      return {
        report: { ...base, status: "error", items: 0, durationMs: Date.now() - started, lastSuccessAt: before?.lastSuccessAt, error: describeError(error) },
        items: [],
        usable: false,
      };
    } finally {
      clearTimeout(timeout);
    }
  });

  const outcomes = await runPool(tasks, options.concurrency ?? 3);

  const succeeded = new Set(outcomes.filter((o) => o.report.status === "ok").map((o) => o.report.sourceId));
  const fresh = outcomes.flatMap((o) => o.items);

  const merged = mergeSnapshot({
    previous: previous?.items ?? [],
    fresh,
    now,
    succeeded,
    retainHours: retainHoursBySource(),
  });
  const items = sortForDisplay(dedupeOpportunities(merged, authorityOf));

  // Reports: this run's outcomes, plus the last known report for sources we did not touch.
  const attempted = new Set(outcomes.map((o) => o.report.sourceId));
  const carried = (previous?.sources ?? []).filter((report) => !attempted.has(report.sourceId) && registry.some((s) => s.id === report.sourceId));
  const sources = [...outcomes.map((o) => o.report), ...carried].sort((a, b) => a.sourceId.localeCompare(b.sourceId));

  return { version: 1, generatedAt: now.toISOString(), sources, items };
}
