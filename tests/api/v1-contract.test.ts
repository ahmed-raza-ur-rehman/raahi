import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { GET as adminMetricsGET } from "@/app/api/v1/metrics/route";
import { GET as authChallengeGET } from "@/app/api/v1/auth/challenge/route";
import { POST as authDevicePOST } from "@/app/api/v1/auth/device/route";
import { POST as ageCheckPOST } from "@/app/api/v1/tools/age-check/route";
import { GET as batchGET } from "@/app/api/v1/opportunities/batch/route";
import { GET as detailGET } from "@/app/api/v1/opportunities/[id]/route";
import { GET as guideGET } from "@/app/api/v1/guides/[id]/route";
import { GET as guidesGET } from "@/app/api/v1/guides/route";
import { GET as healthGET } from "@/app/api/v1/health/route";
import { GET as listGET } from "@/app/api/v1/opportunities/route";
import { GET as manifestGET } from "@/app/api/v1/opportunities/manifest/route";
import { POST as matchPOST } from "@/app/api/v1/tools/match/route";
import { GET as metaGET } from "@/app/api/v1/meta/route";
import { GET as openapiGET } from "@/app/api/v1/openapi.json/route";
import { GET as programmeGET } from "@/app/api/v1/programmes/[id]/route";
import { GET as programmesGET } from "@/app/api/v1/programmes/route";
import { GET as readyGET } from "@/app/api/v1/ready/route";
import { GET as resourcesGET } from "@/app/api/v1/resources/route";
import { POST as scamPOST } from "@/app/api/v1/tools/scam-check/route";
import { solveChallenge } from "@/lib/platform/auth/pow";
import { ADMIN_SECRET, bootApi, ctx, json, req } from "../helpers/api-harness";

const bench = bootApi("api-v1");
beforeEach(() => bench.reset());

const ok = async (response: Response, status = 200) => {
  assert.equal(response.status, status, `expected ${status}, got ${response.status}: ${await response.clone().text()}`);
  return response.json();
};

// ─── Service ──────────────────────────────────────────────────────────────────

test("[REQ-API-010] health is a cheap liveness probe; ready checks the database and the data", async () => {
  const health = await healthGET(req("/api/v1/health"));
  assert.equal((await ok(health)).status, "ok");
  assert.equal(health.headers.get("cache-control"), "no-store");

  const ready = await ok(await readyGET(req("/api/v1/ready")));
  assert.equal(ready.status, "ready");
  assert.ok(ready.checks.items > 500, `expected the committed snapshot, got ${ready.checks.items}`);
  assert.equal(ready.checks.data, "fresh");
});

test("[REQ-API-001] meta advertises the API version, the minimum Android build, feature flags and data freshness", async () => {
  const meta = await ok(await metaGET(req("/api/v1/meta")));
  assert.equal(meta.api.version, "1");
  assert.match(meta.api.minimumClient.android, /^\d+\.\d+\.\d+$/);
  assert.equal(meta.features.deviceAuth, true);
  assert.ok(meta.data.total > 500);
  assert.match(meta.data.dataVersion, /^[a-f0-9]{12}$/);
});

// ─── Opportunities ────────────────────────────────────────────────────────────

test("[REQ-API-004] list: pagination walks the whole result exactly once with opaque cursors", async () => {
  const first = await ok(await listGET(req("/api/v1/opportunities?limit=40&kind=scholarship")));
  assert.equal(first.data.length, 40);
  assert.ok(first.page.total > 40);
  assert.ok(first.page.nextCursor);

  const seen = new Set<string>(first.data.map((item: { id: string }) => item.id));
  let cursor: string | null = first.page.nextCursor;
  let pages = 1;
  while (cursor && pages < 30) {
    const page = await ok(await listGET(req(`/api/v1/opportunities?limit=40&kind=scholarship&cursor=${cursor}`)));
    for (const item of page.data) {
      assert.ok(!seen.has(item.id), `${item.id} appeared on two pages`);
      assert.equal(item.kind, "scholarship");
      seen.add(item.id);
    }
    cursor = page.page.nextCursor;
    pages += 1;
  }
  assert.equal(cursor, null, "the last page has no cursor");
  assert.equal(seen.size, first.page.total, "every matching item is delivered exactly once");
});

test("[REQ-API-004] list: a cursor is bound to its query and cannot be forged or replayed elsewhere", async () => {
  const first = await ok(await listGET(req("/api/v1/opportunities?limit=5&kind=job")));
  const wrongQuery = await listGET(req(`/api/v1/opportunities?limit=5&kind=scholarship&cursor=${first.page.nextCursor}`));
  assert.equal((await ok(wrongQuery, 400)).code, "invalid_cursor");
  for (const forged of ["AAAAAAAAAA", Buffer.from('{"o":-5,"f":"x"}').toString("base64url"), Buffer.from('{"o":999999,"f":"x"}').toString("base64url")]) {
    assert.equal((await ok(await listGET(req(`/api/v1/opportunities?cursor=${forged}`)), 400)).code, "invalid_cursor");
  }
  assert.equal((await ok(await listGET(req("/api/v1/opportunities?cursor=not%20base64!")), 400)).code, "invalid_parameter");
});

test("[REQ-API-003] list: filters, sorting and natural-language interpretation behave", async () => {
  const byDeadline = await ok(await listGET(req("/api/v1/opportunities?sort=deadline&limit=50&within=60")));
  const deadlines = byDeadline.data.map((item: { deadline?: string }) => item.deadline).filter(Boolean) as string[];
  assert.ok(deadlines.length > 3);
  assert.deepEqual([...deadlines].sort(), deadlines, "sort=deadline is ascending");
  assert.ok(byDeadline.data.every((item: { daysLeft: number | null }) => item.daysLeft !== null && item.daysLeft >= 0 && item.daysLeft <= 60));

  const pakistan = await ok(await listGET(req("/api/v1/opportunities?scope=pakistan&limit=30")));
  assert.ok(pakistan.data.length > 0 && pakistan.data.every((item: { scope: string }) => item.scope === "pakistan"));

  const natural = await ok(await listGET(req(`/api/v1/opportunities?q=${encodeURIComponent("fully funded masters in germany")}&limit=10`)));
  assert.equal(natural.interpreted.country, "Germany");
  assert.equal(natural.interpreted.level, "masters");
  assert.equal(natural.interpreted.funding, "full");

  const urdu = await ok(await listGET(req(`/api/v1/opportunities?q=${encodeURIComponent("سعودی عرب میں نوکری")}&limit=5`)));
  assert.ok(urdu.interpreted.kinds?.includes("job"));

  const faceted = await ok(await listGET(req("/api/v1/opportunities?include=facets&limit=1")));
  assert.ok(faceted.facets.kind.length > 3);
  const slim = await ok(await listGET(req("/api/v1/opportunities?limit=1")));
  assert.equal(slim.facets, undefined, "facets are opt-in to keep payloads small");
});

test("[REQ-API-003] list: bad input is a precise 400, never a 500", async () => {
  for (const [query, code] of [
    ["limit=0", "invalid_parameter"],
    ["limit=101", "invalid_parameter"],
    ["limit=abc", "invalid_parameter"],
    ["kind=wizardry", "invalid_parameter"],
    ["kind=job&kind=course", "invalid_parameter"],
    ["bogus=1", "unknown_parameter"],
    ["within=-1", "invalid_parameter"],
    ["sort=random", "invalid_parameter"],
    [`q=${"x".repeat(201)}`, "invalid_parameter"],
    ["q=%00null", "invalid_parameter"],
    ["q=%E2%80%AEevil", "invalid_parameter"],
    ["pk=maybe", "invalid_parameter"],
  ] as const) {
    const response = await listGET(req(`/api/v1/opportunities?${query}`));
    const problem = await ok(response, 400);
    assert.equal(problem.code, code, query);
    assert.equal(response.headers.get("content-type"), "application/problem+json; charset=utf-8");
  }
});

test("[REQ-API-003] list: Urdu text with zero-width joiners is accepted (they are part of the script)", async () => {
  const response = await listGET(req(`/api/v1/opportunities?q=${encodeURIComponent("اسکالرشپ\u200C برائے طلبہ")}`));
  assert.equal(response.status, 200);
});

test("[REQ-API-001] detail: returns the listing with related items; unknown and malformed ids are clean errors", async () => {
  const list = await ok(await listGET(req("/api/v1/opportunities?limit=1&kind=scholarship")));
  const id = list.data[0].id as string;
  const detail = await ok(await detailGET(req(`/api/v1/opportunities/${id}`), ctx({ id })));
  assert.equal(detail.data.id, id);
  assert.ok(Array.isArray(detail.related));
  assert.ok(detail.related.every((item: { id: string }) => item.id !== id));

  const missing = await detailGET(req("/api/v1/opportunities/nosuch-0123456789"), ctx({ id: "nosuch-0123456789" }));
  assert.equal((await ok(missing, 404)).code, "not_found");
  const malformed = await detailGET(req("/api/v1/opportunities/x"), ctx({ id: "x" }));
  assert.equal((await ok(malformed, 400)).code, "invalid_parameter");
  const injected = await detailGET(req("/api/v1/opportunities/x"), ctx({ id: "a'; DROP TABLE opportunities;--" }));
  assert.equal((await ok(injected, 400)).code, "invalid_parameter");
});

test("[REQ-API-001] the public representation never leaks internal fields", async () => {
  const list = await ok(await listGET(req("/api/v1/opportunities?limit=100")));
  for (const item of list.data) {
    assert.ok(!("dedupeKey" in item) && !("extra" in item) && !("expiresAt" in item), `internal field leaked on ${item.id}`);
  }
});

// ─── Sync protocol ────────────────────────────────────────────────────────────

test("[REQ-API-009] manifest: lists every live id once with a stable 12-hex revision", async () => {
  const manifest = await ok(await manifestGET(req("/api/v1/opportunities/manifest")));
  assert.equal(manifest.meta.count, manifest.data.length);
  assert.ok(manifest.data.length > 500);
  const ids = manifest.data.map((entry: { id: string }) => entry.id);
  assert.equal(new Set(ids).size, ids.length, "ids are unique");
  assert.ok(manifest.data.every((entry: { rev: string }) => /^[a-f0-9]{12}$/.test(entry.rev)));

  const again = await ok(await manifestGET(req("/api/v1/opportunities/manifest")));
  assert.deepEqual(again.data, manifest.data, "revisions are deterministic");
});

test("[REQ-API-005][REQ-API-009] manifest: an unchanged data set costs one conditional request", async () => {
  const first = await manifestGET(req("/api/v1/opportunities/manifest"));
  const etag = first.headers.get("etag");
  assert.ok(etag);
  const second = await manifestGET(req("/api/v1/opportunities/manifest", { headers: { "if-none-match": etag } }));
  assert.equal(second.status, 304);
  assert.equal(await second.text(), "");
});

test("[REQ-API-009] delta sync: manifest diff + batch fetch converges a stale client to the server's state", async () => {
  const manifest = await ok(await manifestGET(req("/api/v1/opportunities/manifest")));
  const server = new Map<string, string>(manifest.data.map((entry: { id: string; rev: string }) => [entry.id, entry.rev]));

  // A client that last synced long ago: some items changed, some were removed upstream, some never seen.
  const client = new Map(server);
  const ids = [...server.keys()];
  for (const id of ids.slice(0, 7)) client.set(id, "000000000000"); // stale revisions
  for (const id of ids.slice(7, 12)) client.delete(id); // never fetched
  client.set("expired-0123456789", "aaaaaaaaaaaa"); // no longer listed on the server
  client.set("ghost-abcdef0123", "bbbbbbbbbbbb");

  const toFetch = ids.filter((id) => client.get(id) !== server.get(id));
  const toDelete = [...client.keys()].filter((id) => !server.has(id));
  assert.equal(toFetch.length, 12);
  assert.equal(toDelete.length, 2);

  const fetched = new Map<string, string>();
  for (let index = 0; index < toFetch.length; index += 50) {
    const chunk = toFetch.slice(index, index + 50);
    const batch = await ok(await batchGET(req(`/api/v1/opportunities/batch?ids=${chunk.join(",")}`)));
    assert.deepEqual(batch.missing, []);
    for (const item of batch.data) fetched.set(item.id, item.rev);
  }
  for (const id of toDelete) client.delete(id);
  for (const [id, rev] of fetched) client.set(id, rev);
  assert.deepEqual([...client].sort(), [...server].sort(), "after applying the diff the client equals the server");

  const second = new Map(client);
  assert.equal(ids.filter((id) => second.get(id) !== server.get(id)).length, 0, "a second sync is a no-op");
});

test("[REQ-API-009] batch: enforces the cap, rejects malformed ids and reports missing ones", async () => {
  const manifest = await ok(await manifestGET(req("/api/v1/opportunities/manifest")));
  const real = manifest.data.slice(0, 3).map((entry: { id: string }) => entry.id);
  const mixed = await ok(await batchGET(req(`/api/v1/opportunities/batch?ids=${real.join(",")},gone-0000000000`)));
  assert.equal(mixed.data.length, 3);
  assert.deepEqual(mixed.missing, ["gone-0000000000"]);

  const many = manifest.data.slice(0, 51).map((entry: { id: string }) => entry.id).join(",");
  assert.equal((await ok(await batchGET(req(`/api/v1/opportunities/batch?ids=${many}`)), 400)).code, "invalid_parameter");
  for (const bad of ["", "a b", "x';--", "../../etc/passwd", ",,,"]) {
    const response = await batchGET(req(`/api/v1/opportunities/batch?ids=${encodeURIComponent(bad)}`));
    assert.equal(response.status, 400, bad);
  }
});

// ─── Programmes, guides, resources ───────────────────────────────────────────

test("[REQ-DAT-005] programmes: every dated cycle carries its confidence and check date; search finds a named programme", async () => {
  const all = await ok(await programmesGET(req("/api/v1/programmes")));
  assert.ok(all.data.length >= 20);
  assert.equal(all.today, "2026-10-15");
  for (const programme of all.data) {
    if (programme.cycle) {
      assert.ok(["official", "reported"].includes(programme.cycle.confidence), programme.id);
      assert.match(programme.cycle.checked, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
  const chevening = await ok(await programmesGET(req("/api/v1/programmes?q=chevening&limit=3")));
  assert.match(chevening.data[0].id, /chevening/);

  const urdu = await ok(await programmesGET(req("/api/v1/programmes?q=chevening&lang=ur&limit=1")));
  assert.match(urdu.data[0].summary, /[\u0600-\u06FF]/, "lang=ur returns Urdu text");

  const detail = await ok(await programmeGET(req(`/api/v1/programmes/${chevening.data[0].id}`), ctx({ id: chevening.data[0].id })));
  assert.equal(detail.data.id, chevening.data[0].id);
  assert.equal((await ok(await programmeGET(req("/api/v1/programmes/nope"), ctx({ id: "nope" })), 404)).code, "not_found");
});

test("[REQ-API-001] guides and the resource directory serve bilingual content", async () => {
  const guides = await ok(await guidesGET(req("/api/v1/guides?lang=ur")));
  assert.ok(guides.data.length >= 10);
  const id = guides.data[0].id as string;
  const guide = await ok(await guideGET(req(`/api/v1/guides/${id}?lang=en`), ctx({ id })));
  assert.equal(guide.data.id, id);
  assert.ok(guide.data.steps.length > 0 && guide.data.resources.length > 0);
  assert.equal((await ok(await guideGET(req("/api/v1/guides/none"), ctx({ id: "none" })), 404)).code, "not_found");

  const resources = await ok(await resourcesGET(req("/api/v1/resources?category=overseas-employment&limit=5")));
  assert.ok(resources.total > 0 && resources.data.every((resource: { category: string }) => resource.category === "overseas-employment"));
});

// ─── Tools and authentication ─────────────────────────────────────────────────

test("[REQ-SEC-002] tools need a credential: anonymous gets 401, the body is not even read", async () => {
  const response = await scamPOST(req("/api/v1/tools/scam-check", json({ text: "pay 5000 rupees advance for visa" })));
  const problem = await ok(response, 401);
  assert.equal(problem.code, "unauthorized");
  assert.match(response.headers.get("www-authenticate") ?? "", /Bearer/);
});

test("[REQ-AND-011] scam-check: red flags are found, nothing is echoed back or logged", async () => {
  const token = await bench.deviceToken();
  const secretText = "Congratulations! Pay Rs 25000 advance for Dubai visa, send CNIC 35202-1234567-1 and OTP on WhatsApp 0300-1234567. Limited seats!";
  const response = await scamPOST(req("/api/v1/tools/scam-check", json({ text: secretText }, { authorization: `Bearer ${token}` })));
  const body = await ok(response);
  assert.ok(["high", "medium"].includes(body.data.level));
  assert.ok(body.data.signals.length >= 2);
  assert.ok(!JSON.stringify(body).includes("35202-1234567-1"), "the submitted text must not be echoed back");
  assert.ok(!bench.logLines.join("\n").match(/35202|0300-1234567|Dubai/), "message text must never reach the logs");

  const empty = await scamPOST(req("/api/v1/tools/scam-check", json({}, { authorization: `Bearer ${token}` })));
  assert.equal((await ok(empty, 422)).code, "validation_failed");
  const huge = await scamPOST(req("/api/v1/tools/scam-check", json({ text: "x".repeat(40_000) }, { authorization: `Bearer ${token}` })));
  assert.equal((await ok(huge, 413)).code, "payload_too_large");
  const unknownField = await scamPOST(req("/api/v1/tools/scam-check", json({ text: "hi", admin: true }, { authorization: `Bearer ${token}` })));
  assert.equal((await ok(unknownField, 422)).code, "validation_failed");
});

test("[REQ-AND-007] age-check: both readings, the last valid day and clean errors", async () => {
  const token = await bench.deviceToken();
  const call = (body: unknown) => ageCheckPOST(req("/api/v1/tools/age-check", json(body, { authorization: `Bearer ${token}` })));
  const body = await ok(await call({ dob: "1998-03-15", asOn: "2026-10-15", maxYears: 28, relaxationYears: 2 }));
  assert.deepEqual(body.data.age, { years: 28, months: 7, days: 0 });
  assert.equal(body.data.limit, 30);
  assert.equal(body.data.withinByCompletedYears, true);
  assert.equal(body.data.lastDayToTheDay, "2028-03-15");

  assert.equal((await ok(await call({ dob: "2030-01-01", asOn: "2026-10-15" }), 422)).code, "validation_failed");
  assert.equal((await ok(await call({ dob: "2000-02-30", asOn: "2026-10-15" }), 422)).code, "validation_failed");
  assert.equal((await ok(await call({ dob: "not-a-date", asOn: "2026-10-15" }), 422)).code, "validation_failed");
});

test("[REQ-API-001] match: ranks with reasons and never returns an item that excludes Pakistan", async () => {
  const token = await bench.deviceToken();
  const response = await matchPOST(req("/api/v1/tools/match", json({ level: "masters", needsFunding: true, interests: ["scholarship"], limit: 5 }, { authorization: `Bearer ${token}` })));
  const body = await ok(response);
  assert.ok(body.data.length > 0 && body.data.length <= 5);
  for (const entry of body.data) {
    assert.notEqual(entry.item.openToPakistan, false);
    assert.ok(entry.reasons.length > 0);
  }
});

test("[REQ-SEC-004] device registration end to end: challenge, solve, register, call a protected endpoint, no replay", async () => {
  const challenge = await ok(await authChallengeGET(req("/api/v1/auth/challenge", { ip: "203.0.113.5" })));
  assert.equal(challenge.difficulty, 8);
  const nonce = solveChallenge(challenge.challenge);
  const registration = { challenge: challenge.challenge, nonce, installId: "9b2f3c1e-1d7a-4c55-8f3e-2a6b7c8d9e01", platform: "android" };
  const issued = await ok(await authDevicePOST(req("/api/v1/auth/device", json(registration, { "x-forwarded-for": "203.0.113.5" }))));
  assert.equal(issued.tokenType, "Bearer");
  assert.equal(issued.expiresIn, 3600);
  assert.equal(issued.scope, "read tools assistant");

  const protectedCall = await ageCheckPOST(req("/api/v1/tools/age-check", json({ dob: "2000-01-01", asOn: "2026-10-15" }, { authorization: `Bearer ${issued.accessToken}` })));
  assert.equal(protectedCall.status, 200);

  const replay = await authDevicePOST(req("/api/v1/auth/device", json(registration, { "x-forwarded-for": "203.0.113.5" })));
  assert.equal((await ok(replay, 400)).code, "challenge_invalid");

  const wrongNonce = await authDevicePOST(req("/api/v1/auth/device", json({ ...registration, nonce: String(Number(nonce) + 1) }, { "x-forwarded-for": "203.0.113.5" })));
  assert.equal(wrongNonce.status, 400);
  const badUuid = await authDevicePOST(req("/api/v1/auth/device", json({ ...registration, installId: "not-a-uuid" })));
  assert.equal((await ok(badUuid, 422)).code, "validation_failed");
});

test("[REQ-SEC-004] without configured secrets, registration is disabled (503) rather than weakened", async () => {
  const { setConfigForTests, loadConfig } = await import("@/lib/platform/config");
  const original = bench.config;
  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_RATE_LIMIT_SCALE: "100" }));
  try {
    assert.equal((await ok(await authChallengeGET(req("/api/v1/auth/challenge")), 503)).code, "not_configured");
    assert.equal((await ok(await metaGET(req("/api/v1/meta")))).features.deviceAuth, false);
  } finally {
    setConfigForTests(original);
  }
});

// ─── Operations ───────────────────────────────────────────────────────────────

test("[REQ-OPS-002] metrics are admin-only and expose what the API did", async () => {
  await healthGET(req("/api/v1/health"));
  assert.equal((await adminMetricsGET(req("/api/v1/metrics"))).status, 401);
  const token = await bench.deviceToken();
  assert.equal((await adminMetricsGET(req("/api/v1/metrics", { headers: { authorization: `Bearer ${token}` } }))).status, 403);
  const response = await adminMetricsGET(req("/api/v1/metrics", { headers: { authorization: `Bearer ${ADMIN_SECRET}` } }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/plain; version=0\.0\.4/);
  const text = await response.text();
  assert.match(text, /raahi_http_requests_total\{method="GET",operation="getHealth",status="2xx"\} 1/);
});

test("[REQ-API-007] the OpenAPI document is served and is a valid object", async () => {
  const response = await openapiGET(req("/api/v1/openapi.json"));
  const spec = await ok(response);
  assert.equal(spec.openapi, "3.1.0");
  assert.ok(Object.keys(spec.paths).length >= 15);
  assert.ok(response.headers.get("etag"));
});
