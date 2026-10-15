/**
 * Minimal, dependency-free metrics in the Prometheus text exposition format.
 *
 * Counters and histograms only, with a hard cap on distinct label sets per metric (excess folds into
 * `other`) so a hostile client cannot grow memory by inventing label values. Metrics are per process: on
 * serverless platforms each instance reports its own totals (documented in docs/operations/observability.md).
 */

type Labels = Record<string, string>;

const MAX_SERIES = 200;

const escapeLabel = (value: string) => value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
const labelKey = (labels: Labels) => Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\u0000");
const render = (labels: Labels) => {
  const parts = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}="${escapeLabel(v)}"`);
  return parts.length > 0 ? `{${parts.join(",")}}` : "";
};

export class Counter {
  private readonly series = new Map<string, { labels: Labels; value: number }>();
  constructor(readonly name: string, readonly help: string, private readonly labelNames: readonly string[] = []) {}

  inc(labels: Labels = {}, by = 1): void {
    const clean = this.normalise(labels);
    const key = labelKey(clean);
    const entry = this.series.get(key);
    if (entry) entry.value += by;
    else if (this.series.size < MAX_SERIES) this.series.set(key, { labels: clean, value: by });
    else this.fold(by);
  }

  value(labels: Labels = {}): number {
    return this.series.get(labelKey(this.normalise(labels)))?.value ?? 0;
  }

  total(): number {
    return [...this.series.values()].reduce((sum, entry) => sum + entry.value, 0);
  }

  reset(): void {
    this.series.clear();
  }

  expose(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} counter`];
    for (const { labels, value } of this.series.values()) lines.push(`${this.name}${render(labels)} ${value}`);
    return lines;
  }

  private normalise(labels: Labels): Labels {
    return Object.fromEntries(this.labelNames.map((name) => [name, String(labels[name] ?? "").slice(0, 80)]));
  }

  private fold(by: number): void {
    const key = labelKey(Object.fromEntries(this.labelNames.map((name) => [name, "other"])));
    const entry = this.series.get(key) ?? { labels: Object.fromEntries(this.labelNames.map((name) => [name, "other"])), value: 0 };
    entry.value += by;
    this.series.set(key, entry);
  }
}

export class Histogram {
  private readonly series = new Map<string, { labels: Labels; counts: number[]; sum: number; count: number }>();
  constructor(readonly name: string, readonly help: string, private readonly buckets: readonly number[], private readonly labelNames: readonly string[] = []) {}

  observe(value: number, labels: Labels = {}): void {
    const clean = Object.fromEntries(this.labelNames.map((name) => [name, String(labels[name] ?? "").slice(0, 80)]));
    const key = labelKey(clean);
    let entry = this.series.get(key);
    if (!entry) {
      if (this.series.size >= MAX_SERIES) return;
      entry = { labels: clean, counts: this.buckets.map(() => 0), sum: 0, count: 0 };
      this.series.set(key, entry);
    }
    this.buckets.forEach((bound, index) => {
      if (value <= bound) entry.counts[index] += 1;
    });
    entry.sum += value;
    entry.count += 1;
  }

  reset(): void {
    this.series.clear();
  }

  expose(): string[] {
    const lines = [`# HELP ${this.name} ${this.help}`, `# TYPE ${this.name} histogram`];
    for (const { labels, counts, sum, count } of this.series.values()) {
      this.buckets.forEach((bound, index) => lines.push(`${this.name}_bucket${render({ ...labels, le: String(bound) })} ${counts[index]}`));
      lines.push(`${this.name}_bucket${render({ ...labels, le: "+Inf" })} ${count}`);
      lines.push(`${this.name}_sum${render(labels)} ${Number(sum.toFixed(6))}`);
      lines.push(`${this.name}_count${render(labels)} ${count}`);
    }
    return lines;
  }
}

export interface Registry {
  httpRequests: Counter;
  httpDuration: Histogram;
  rateLimited: Counter;
  authFailures: Counter;
  contractViolations: Counter;
  expose(): string;
  reset(): void;
}

function createRegistry(): Registry {
  const httpRequests = new Counter("raahi_http_requests_total", "HTTP requests handled, by operation, method and status class.", ["operation", "method", "status"]);
  const httpDuration = new Histogram("raahi_http_request_duration_seconds", "Time spent handling an API request.", [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10], ["operation"]);
  const rateLimited = new Counter("raahi_rate_limited_total", "Requests rejected by the rate limiter.", ["policy", "tier"]);
  const authFailures = new Counter("raahi_auth_failures_total", "Rejected credentials, by reason.", ["reason"]);
  const contractViolations = new Counter("raahi_contract_violations_total", "Responses that did not match their declared schema.", ["operation"]);
  const all = [httpRequests, httpDuration, rateLimited, authFailures, contractViolations];
  return {
    httpRequests,
    httpDuration,
    rateLimited,
    authFailures,
    contractViolations,
    expose: () => `${all.flatMap((metric) => metric.expose()).join("\n")}\n`,
    reset: () => all.forEach((metric) => metric.reset()),
  };
}

const globalKey = Symbol.for("raahi.platform.metrics");
const holder = globalThis as unknown as Record<symbol, Registry | undefined>;

/** Process-wide registry (survives dev hot reloads via globalThis). */
export const metrics: Registry = (holder[globalKey] ??= createRegistry());
