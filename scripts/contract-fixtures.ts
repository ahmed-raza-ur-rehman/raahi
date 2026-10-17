/**
 * Generate the golden contract fixtures in contract/v1/.
 *
 * The fixtures are real responses captured from the real route handlers at a pinned instant, plus test vectors for the
 * logic the Android app re-implements offline (age arithmetic, deadline status, proof of work). The server's tests
 * check that they match the schemas and are current; the Android client's tests parse the very same files. That makes
 * the two sides a consumer-driven contract: neither can drift without a test failing.
 *
 *   npm run contract:write   regenerate
 *   npm run contract:check   fail if the committed files are out of date (CI)
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { GET as detailGET } from "@/app/api/v1/opportunities/[id]/route";
import { GET as guideGET } from "@/app/api/v1/guides/[id]/route";
import { GET as guidesGET } from "@/app/api/v1/guides/route";
import { GET as listGET } from "@/app/api/v1/opportunities/route";
import { GET as programmeGET } from "@/app/api/v1/programmes/[id]/route";
import { GET as programmesGET } from "@/app/api/v1/programmes/route";
import { GET as resourcesGET } from "@/app/api/v1/resources/route";
import { POST as ageCheckPOST } from "@/app/api/v1/tools/age-check/route";
import { POST as scamPOST } from "@/app/api/v1/tools/scam-check/route";
import { dataVersionOf, toOpportunityV1 } from "@/lib/api/v1/mappers";
import { leadingZeroBits, powDigest } from "@/lib/platform/auth/pow";
import { setPlatformClock } from "@/lib/platform/clock";
import { loadConfig, setConfigForTests } from "@/lib/platform/config";
import { checkAge } from "@/lib/opportunities/age";
import { computeStatus, isRecentlySeen } from "@/lib/opportunities/dates";
import { dataStamp, getOpportunitiesByIds } from "@/lib/opportunities/store";
import { revisionOf } from "@/lib/api/v1/mappers";
import { NOW, bootApi, ctx, json, req } from "../tests/helpers/api-harness";

const root = join(process.cwd(), "contract", "v1");
const check = process.argv.includes("--check");
const files = new Map<string, string>();
const put = (name: string, value: unknown) => files.set(name, `${JSON.stringify(value, null, 2)}\n`);

const bench = bootApi("fixtures");
const trace = { "x-request-id": "fixture-request-0001" };
const ok = async (response: Response, status = 200) => {
  if (response.status !== status) throw new Error(`fixture request returned ${response.status}: ${await response.text()}`);
  return response.json();
};
const index: Array<{ file: string; operationId: string; request: string; status: number }> = [];
const record = (file: string, operationId: string, request: string, status: number, body: unknown) => {
  put(file, body);
  index.push({ file, operationId, request, status });
};

async function main() {
  const token = await bench.deviceToken();
  const auth = { authorization: `Bearer ${token}`, ...trace };

  // ── Opportunities ──────────────────────────────────────────────────────────
  const listUrl = "/api/v1/opportunities?limit=5&kind=scholarship&include=facets";
  const list = await ok(await listGET(req(listUrl, { headers: trace })));
  record("opportunities.list.json", "listOpportunities", `GET ${listUrl}`, 200, list);
  const nextUrl = `${listUrl}&cursor=${list.page.nextCursor}`;
  record("opportunities.list.next.json", "listOpportunities", `GET ${nextUrl}`, 200, await ok(await listGET(req(nextUrl, { headers: trace }))));
  const id = list.data[0].id as string;
  record("opportunities.detail.json", "getOpportunity", `GET /api/v1/opportunities/${id}`, 200, await ok(await detailGET(req(`/api/v1/opportunities/${id}`, { headers: trace }), ctx({ id }))));

  // ── Delta-sync scenario: a 12-item world (v1) that changes (v2) ────────────
  const world = await ok(await listGET(req("/api/v1/opportunities?limit=12&sort=newest", { headers: trace })));
  const ids = world.data.map((item: { id: string }) => item.id) as string[];
  const views = getOpportunitiesByIds(ids, NOW);
  const meta1 = { generatedAt: dataStamp(NOW).generatedAt ?? null, dataVersion: dataVersionOf(dataStamp(NOW)) };
  const v1Items = views.map(toOpportunityV1);
  put("sync/items.v1.json", v1Items);
  put("sync/manifest.v1.json", { data: v1Items.map(({ id: itemId, rev }) => ({ id: itemId, rev })), meta: { ...meta1, count: v1Items.length } });

  const changed = views.slice(0, 2).map((view) => ({ ...view, title: `${view.title} (updated)` }));
  const added = { ...views[2], id: "demo-0123456789", title: "A newly listed scholarship", firstSeen: "2026-10-15T07:00:00.000Z" };
  const keep = views.slice(2, 10);
  const v2Views = [...changed, ...keep, added];
  const v2Items = v2Views.map((view) => toOpportunityV1({ ...view }));
  // `rev` must be recomputed from the changed content, exactly as the server would.
  const v2WithRev = v2Items.map((item, index) => ({ ...item, rev: revisionOf(v2Views[index]) }));
  put("sync/items.v2.json", v2WithRev);
  put("sync/manifest.v2.json", { data: v2WithRev.map(({ id: itemId, rev }) => ({ id: itemId, rev })), meta: { ...meta1, dataVersion: "v2v2v2v2v2v2", count: v2WithRev.length } });
  put("sync/README.json", { note: `items.vN.json is every listing in state N; manifest.vN.json its manifest. v2 = ${changed.length} changed (new rev), ${ids.length - 10} removed (the last two of v1), 1 added, ${keep.length} unchanged. A client synced to v1 must end up equal to v2 after one sync.`, removedIds: ids.slice(10), changedIds: changed.map((view) => view.id), addedIds: [added.id], unchangedCount: keep.length });

  // ── Programmes, guides, resources ──────────────────────────────────────────
  record("programmes.list.json", "listProgrammes", "GET /api/v1/programmes?limit=3", 200, await ok(await programmesGET(req("/api/v1/programmes?limit=3", { headers: trace }))));
  record("programmes.list.ur.json", "listProgrammes", "GET /api/v1/programmes?q=chevening&lang=ur&limit=1", 200, await ok(await programmesGET(req("/api/v1/programmes?q=chevening&lang=ur&limit=1", { headers: trace }))));
  const programmeId = (await ok(await programmesGET(req("/api/v1/programmes?q=chevening&limit=1")))).data[0].id as string;
  record("programmes.detail.json", "getProgramme", `GET /api/v1/programmes/${programmeId}`, 200, await ok(await programmeGET(req(`/api/v1/programmes/${programmeId}`, { headers: trace }), ctx({ id: programmeId }))));
  const guides = await ok(await guidesGET(req("/api/v1/guides?limit=3&lang=en", { headers: trace })));
  record("guides.list.json", "listGuides", "GET /api/v1/guides?limit=3&lang=en", 200, guides);
  const guideId = guides.data[0].id as string;
  record("guides.detail.json", "getGuide", `GET /api/v1/guides/${guideId}?lang=en`, 200, await ok(await guideGET(req(`/api/v1/guides/${guideId}?lang=en`, { headers: trace }), ctx({ id: guideId }))));
  record("resources.list.json", "listResources", "GET /api/v1/resources?category=overseas-employment&limit=3", 200, await ok(await resourcesGET(req("/api/v1/resources?category=overseas-employment&limit=3", { headers: trace }))));

  // ── Tools ──────────────────────────────────────────────────────────────────
  const scamRequest = { text: "Congratulations! Pay Rs 25000 advance for a Dubai visa and send your CNIC and OTP on WhatsApp. Limited seats!" };
  put("tools.scam-check.json", { request: scamRequest, response: await ok(await scamPOST(req("/api/v1/tools/scam-check", json(scamRequest, auth)))) });
  index.push({ file: "tools.scam-check.json", operationId: "checkOffer", request: "POST /api/v1/tools/scam-check", status: 200 });
  const ageRequest = { dob: "1998-03-15", asOn: "2026-10-15", maxYears: 28, relaxationYears: 2 };
  put("tools.age-check.json", { request: ageRequest, response: await ok(await ageCheckPOST(req("/api/v1/tools/age-check", json(ageRequest, auth)))) });
  index.push({ file: "tools.age-check.json", operationId: "checkAge", request: "POST /api/v1/tools/age-check", status: 200 });

  // ── Problem documents (what the client must handle) ───────────────────────
  record("problems.unknown-parameter.json", "listOpportunities", "GET /api/v1/opportunities?bogus=1", 400, await ok(await listGET(req("/api/v1/opportunities?bogus=1", { headers: trace })), 400));
  record("problems.validation-failed.json", "checkOffer", "POST /api/v1/tools/scam-check {}", 422, await ok(await scamPOST(req("/api/v1/tools/scam-check", json({}, auth))), 422));
  record("problems.unauthorized.json", "checkOffer", "POST /api/v1/tools/scam-check (no credential)", 401, await ok(await scamPOST(req("/api/v1/tools/scam-check", json(scamRequest, trace))), 401));

  setPlatformClock(() => NOW.getTime() + 2 * 3600 * 1000);
  record("problems.token-expired.json", "checkOffer", "POST /api/v1/tools/scam-check (token older than its lifetime)", 401, await ok(await scamPOST(req("/api/v1/tools/scam-check", json(scamRequest, auth))), 401));
  setPlatformClock(() => NOW.getTime());

  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "0.05", RAAHI_TOKEN_SECRETS: bench.config.tokenSecrets.map((secret) => `${secret.kid}:${Buffer.from(secret.key).toString("base64url")}`).join(",") }));
  bench.reset();
  await listGET(req("/api/v1/opportunities?limit=1", { headers: trace, ip: "203.0.113.200" }));
  const limited = await listGET(req("/api/v1/opportunities?limit=1", { headers: trace, ip: "203.0.113.200" }));
  const limitedBody = await ok(limited, 429);
  put("problems.rate-limited.json", { headers: { "Retry-After": limited.headers.get("retry-after"), "RateLimit-Remaining": limited.headers.get("ratelimit-remaining") }, body: limitedBody });
  index.push({ file: "problems.rate-limited.json", operationId: "listOpportunities", request: "GET /api/v1/opportunities (limit exceeded)", status: 429 });
  setConfigForTests(bench.config);

  // ── Vectors for logic the Android app re-implements ───────────────────────
  const ageCases = [
    ["1998-03-15", "2026-10-15"], ["2000-02-29", "2026-02-28"], ["2000-02-29", "2026-03-01"], ["2000-02-29", "2024-02-29"], ["1999-01-31", "2026-02-28"],
    ["1999-01-31", "2024-02-29"], ["2000-12-31", "2026-01-01"], ["2026-10-15", "2026-10-15"], ["1990-05-20", "2026-05-19"], ["1990-05-20", "2026-05-20"],
    ["1990-05-20", "2026-05-21"], ["1985-07-04", "2026-07-04"], ["2004-11-30", "2026-03-31"], ["1996-08-31", "2026-02-28"], ["1970-01-01", "2026-12-31"],
  ];
  const limits = [{}, { maxYears: 30 }, { maxYears: 28, relaxationYears: 5 }, { maxYears: 25, minYears: 18 }, { minYears: 21 }];
  const ageVectors = ageCases.flatMap(([dob, asOn]) => limits.map((limit) => ({ input: { dob, asOn, ...limit }, expected: checkAge({ dob, asOn, ...limit }) ?? null })));
  ageVectors.push({ input: { dob: "2030-01-01", asOn: "2026-10-15" }, expected: null }, { input: { dob: "2000-02-30", asOn: "2026-10-15" }, expected: null } as never);
  put("vectors/age.json", ageVectors);

  const instants = ["2026-10-15T00:00:00Z", "2026-10-15T18:59:59Z", "2026-10-15T19:00:00Z", "2026-10-15T23:59:59Z", "2026-10-16T18:59:59Z", "2026-12-31T19:00:00Z"];
  const deadlines = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-22", "2026-10-23", "2026-11-30", "2027-03-01", undefined];
  const statusVectors = instants.flatMap((now) =>
    deadlines.flatMap((deadline) => [false, true].map((rolling) => ({ now, deadline: deadline ?? null, rolling, expected: computeStatus({ deadline, rolling, kind: "scholarship" }, new Date(now)) }))),
  );
  put("vectors/status.json", statusVectors);
  const newVectors = [
    ["2026-10-15T08:00:00Z", "2026-10-15T07:00:00Z"], ["2026-10-15T08:00:00Z", "2026-10-12T08:00:00Z"], ["2026-10-15T08:00:00Z", "2026-10-12T07:59:59Z"], ["2026-10-15T08:00:00Z", "2026-10-01T00:00:00Z"],
  ].map(([now, firstSeen]) => ({ now, firstSeen, expected: isRecentlySeen(firstSeen, new Date(now)) }));
  put("vectors/is-new.json", newVectors);

  const salts = ["fixtureSaltAAAAAAAAAAAA", "fixtureSaltBBBBBBBBBBBB", "fixtureSaltCCCCCCCCCCCC", "uRBnXq3p0m6Zk1dEwY9Hjg"];
  const powVectors = salts.flatMap((salt) => [8, 12, 14].map((difficulty) => {
    let nonce = 0;
    while (leadingZeroBits(powDigest(salt, nonce)) < difficulty) nonce += 1;
    return { salt, difficulty, nonce, digestHex: powDigest(salt, nonce).toString("hex") };
  }));
  put("vectors/pow.json", { rule: "nonce is the smallest non-negative integer such that SHA-256(`${salt}:${nonce}` as UTF-8) has at least `difficulty` leading zero bits", vectors: powVectors, bits: [["00ff", 8], ["0fff", 4], ["8000", 0], ["0000", 16], ["00", 8], ["0180", 7], ["000f", 12]].map(([hex, bits]) => ({ hex, bits })) });

  put("index.json", { apiVersion: "1", capturedAt: NOW.toISOString(), note: "Generated by `npm run contract:write`. Do not edit by hand.", files: index.sort((a, b) => a.file.localeCompare(b.file)) });
}

function listFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name), base) : [join(dir, entry.name).slice(base.length + 1)]));
}

main()
  .then(() => {
    if (check) {
      const stale = [...files].filter(([name, content]) => !existsSync(join(root, name)) || readFileSync(join(root, name), "utf8") !== content).map(([name]) => name);
      const extra = listFiles(root).filter((name) => !files.has(name) && name !== "README.md");
      if (stale.length > 0 || extra.length > 0) {
        console.error(`Contract fixtures are out of date.\n  stale/missing: ${stale.join(", ") || "-"}\n  unexpected: ${extra.join(", ") || "-"}\nRun \`npm run contract:write\` and commit the result.`);
        process.exit(1);
      }
      console.log(`Contract fixtures are up to date (${files.size} files).`);
      return;
    }
    for (const name of listFiles(root)) if (name !== "README.md") rmSync(join(root, name));
    for (const [name, content] of files) {
      mkdirSync(dirname(join(root, name)), { recursive: true });
      writeFileSync(join(root, name), content);
    }
    console.log(`Wrote ${files.size} fixtures to contract/v1.`);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
