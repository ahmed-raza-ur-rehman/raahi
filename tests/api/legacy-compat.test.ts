import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { GET as ecosystemGET } from "@/app/api/ecosystem/route";
import { GET as guidesGET } from "@/app/api/guides/route";
import { GET as legacyDetailGET } from "@/app/api/opportunities/[id]/route";
import { GET as legacyFlagshipsGET } from "@/app/api/opportunities/flagships/route";
import { GET as legacyListGET, OPTIONS as legacyListOPTIONS } from "@/app/api/opportunities/route";
import { POST as legacyScamPOST } from "@/app/api/opportunities/scam-check/route";
import { GET as legacyStatusGET } from "@/app/api/opportunities/status/route";
import { GET as resourcesGET } from "@/app/api/resources/route";
import { loadConfig, setConfigForTests } from "@/lib/platform/config";
import { bootApi, ctx, json, req } from "../helpers/api-harness";

const bench = bootApi("api-legacy-compat");
beforeEach(() => bench.reset());

test("REQ-API-011 the original opportunity endpoints keep the response shapes the web UI, the widget and the sibling apps rely on", async () => {
  const list = await legacyListGET(req("/api/opportunities?kind=scholarship&limit=5"));
  assert.equal(list.status, 200);
  const body = await list.json();
  assert.ok(Array.isArray(body.items) && body.items.length === 5 && typeof body.total === "number");
  assert.ok(body.facets && body.interpreted && body.generatedAt, "facets, interpreted filters and the snapshot time are still there");
  assert.equal(body.items[0].kind, "scholarship");
  assert.ok("status" in body.items[0] && "daysLeft" in body.items[0] && "isNew" in body.items[0]);

  const id = body.items[0].id as string;
  const detail = await (await legacyDetailGET(req(`/api/opportunities/${id}`), ctx({ id }) as { params: Promise<{ id: string }> })).json();
  assert.equal(detail.item.id, id);
  assert.ok(Array.isArray(detail.related) && Array.isArray(detail.plan) && Array.isArray(detail.checklist) && Array.isArray(detail.prep));

  const status = await (await legacyStatusGET(req("/api/opportunities/status"))).json();
  assert.ok(status.total > 500 && Array.isArray(status.sources) && Array.isArray(status.registry));
  const guides = await (await guidesGET(req("/api/guides?lang=ur"))).json();
  assert.ok(guides.total > 5 && Array.isArray(guides.items) && Array.isArray(guides.categories));
  const resources = await (await resourcesGET(req("/api/resources?category=overseas-employment"))).json();
  assert.ok(Array.isArray(resources.items) || Array.isArray(resources.results), "directory entries still listed");
  const flagships = await legacyFlagshipsGET(req("/api/opportunities/flagships?q=chevening"));
  assert.equal(flagships.status, 200);
  const ecosystem = await (await ecosystemGET(req("/api/ecosystem"))).json();
  assert.equal(ecosystem.apps.length, 3);
});

test("REQ-API-011 behind the guard they gain request ids, hardening headers and rate limits but keep their open CORS", async () => {
  const list = await legacyListGET(req("/api/opportunities?limit=1", { headers: { "x-request-id": "legacy-trace-0001" } }));
  assert.equal(list.headers.get("x-request-id"), "legacy-trace-0001");
  assert.equal(list.headers.get("x-content-type-options"), "nosniff");
  assert.equal(list.headers.get("access-control-allow-origin"), "*", "the widget and sibling apps call these from other origins");
  assert.match(list.headers.get("cache-control") ?? "", /s-maxage=300/);
  assert.equal(legacyListOPTIONS().status, 204);

  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "0.1" }));
  try {
    const statuses: number[] = [];
    let limited: Response | undefined;
    for (let index = 0; index < 20 && !limited; index++) {
      const response = await legacyListGET(req("/api/opportunities?limit=1", { ip: "203.0.113.150" }));
      statuses.push(response.status);
      if (response.status === 429) limited = response;
    }
    assert.ok(limited, `never limited: ${statuses}`);
    const problem = await limited.json();
    assert.equal(problem.code, "rate_limited");
    assert.ok(problem.error && problem.requestId, "the legacy error shape {error} is kept, with the new code and request id");
    assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  } finally {
    setConfigForTests(bench.config);
  }
});

test("REQ-API-011 the public stateless tools still accept calls from other sites (no cookies, so no cross-site write check)", async () => {
  const response = await legacyScamPOST(
    req("/api/opportunities/scam-check", json({ text: "Pay Rs 25000 advance for a visa and send your OTP" }, { origin: "https://psc-ajk.vercel.app", "sec-fetch-site": "cross-site" })),
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(["high", "medium"].includes(result.level));
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
});
