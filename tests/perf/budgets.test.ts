import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { gzipSync } from "node:zlib";
import { GET as listGET } from "@/app/api/v1/opportunities/route";
import { GET as manifestGET } from "@/app/api/v1/opportunities/manifest/route";
import { bootApi, req } from "../helpers/api-harness";

/**
 * Performance budgets. They are regression guards with generous headroom (measured values are 5-10x below the limits), not
 * benchmarks: a change that makes search 10x slower or the sync manifest 2x bigger fails here instead of in a user's hand.
 * `RAAHI_PERF_SCALE=3` relaxes the time budgets on a slow machine.
 */
bootApi("perf-budgets");
const scale = Number(process.env.RAAHI_PERF_SCALE ?? "1") || 1;

const QUERIES = ["", "scholarship", "fully funded masters in germany", "jobs lahore", "internship remote", "اسکالرشپ", "chevening", "free udemy python", "mulazmat saudi arab", "phd computer science europe"];

async function percentile95(make: (index: number) => string, runs: number): Promise<{ p50: number; p95: number }> {
  for (let warm = 0; warm < 15; warm++) await (await listGET(req(make(warm)))).arrayBuffer();
  const times: number[] = [];
  for (let index = 0; index < runs; index++) {
    const started = performance.now();
    const response = await listGET(req(make(index)));
    await response.arrayBuffer();
    assert.equal(response.status, 200);
    times.push(performance.now() - started);
  }
  times.sort((a, b) => a - b);
  return { p50: times[Math.floor(runs * 0.5)], p95: times[Math.floor(runs * 0.95)] };
}

test("REQ-PERF-001 searching the whole data set stays within the latency budget (p95 under 100 ms through the full handler)", async () => {
  const text = await percentile95((index) => `/api/v1/opportunities?limit=24&q=${encodeURIComponent(QUERIES[index % QUERIES.length])}`, 250);
  const filtered = await percentile95((index) => `/api/v1/opportunities?limit=24&kind=${["job", "scholarship", "internship"][index % 3]}&pk=1&sort=deadline`, 200);
  assert.ok(text.p95 < 100 * scale, `text search p95 ${text.p95.toFixed(1)} ms`);
  assert.ok(filtered.p95 < 100 * scale, `filtered browse p95 ${filtered.p95.toFixed(1)} ms`);
  assert.ok(text.p50 < 40 * scale, `text search median ${text.p50.toFixed(1)} ms`);
});

test("REQ-PERF-002 the sync manifest fits a mobile data budget and an unchanged data set sends no body", async () => {
  const first = await manifestGET(req("/api/v1/opportunities/manifest"));
  const body = await first.text();
  const raw = Buffer.byteLength(body);
  const gzipped = gzipSync(body).length;
  const entries = JSON.parse(body).data.length as number;
  assert.ok(raw < 100_000, `manifest is ${raw} bytes raw for ${entries} listings`);
  assert.ok(gzipped < 30_000, `manifest is ${gzipped} bytes gzipped`);
  assert.ok(raw / entries < 80, `${(raw / entries).toFixed(0)} bytes per listing: the manifest must stay compact`);

  const second = await manifestGET(req("/api/v1/opportunities/manifest", { headers: { "if-none-match": first.headers.get("etag") ?? "" } }));
  assert.equal(second.status, 304);
  assert.equal((await second.arrayBuffer()).byteLength, 0);
});

function jsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? jsFiles(path) : path.endsWith(".js") ? [path] : [];
  });
}

test("REQ-PERF-004 the shipped client JavaScript stays within its budget (checked whenever a production build exists)", { skip: !existsSync(join(process.cwd(), ".next", "static", "chunks")) && "run `npm run build` first" }, () => {
  const files = jsFiles(join(process.cwd(), ".next", "static", "chunks"));
  assert.ok(files.length > 0);
  const sizes = files.map((file) => statSync(file).size);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const gzipped = gzipSync(Buffer.concat(files.map((file) => readFileSync(file)))).length;
  const largest = Math.max(...sizes);
  assert.ok(total < 2_300_000, `all client chunks together: ${total} bytes raw`);
  assert.ok(gzipped < 650_000, `all client chunks together: ${gzipped} bytes gzipped`);
  assert.ok(largest < 520_000, `largest single chunk: ${largest} bytes`);
});
