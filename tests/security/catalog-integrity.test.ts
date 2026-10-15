import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test, { beforeEach } from "node:test";

process.env.OPPORTUNITIES_BUNDLED = "off";
process.env.OPPORTUNITIES_SNAPSHOT_URL = "off";
const dbPath = join(process.cwd(), "data", "raahi.sec-catalog.test.db");
for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
process.env.RAAHI_DB_PATH = dbPath;

import { GET as organizationsGET, POST as organizationsPOST } from "@/app/api/organizations/route";
import { GET as programsGET, POST as programsPOST } from "@/app/api/programs/route";
import { POST as reviewPOST } from "@/app/api/v1/admin/submissions/[id]/route";
import { GET as submissionsGET } from "@/app/api/v1/admin/submissions/route";
import { getSqlite } from "@/lib/db/client";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { MAX_PENDING_SUBMISSIONS, findServiceById, listActiveServices } from "@/lib/db/repositories/services";
import { loadConfig, setConfigForTests } from "@/lib/platform/config";
import { MemoryRateLimitStore, setRateLimitStore } from "@/lib/platform/limit/store";
import { createLogger, setLoggerForTests } from "@/lib/platform/log";

const ADMIN = "catalog-admin-secret-0123456789abcdef";
let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter++ % 250) + 1}`;

beforeEach(() => {
  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "100", RAAHI_ADMIN_SECRET: ADMIN }));
  setRateLimitStore(new MemoryRateLimitStore());
  setLoggerForTests(createLogger({ level: "silent" }));
  ensureDatabaseSeeded();
});

const valid = {
  organizationId: "edhi-foundation",
  domain: "health",
  name: "Free ambulance referral",
  nameUr: "مفت ایمبولینس",
  description: "A partner service that arranges ambulance referrals in the district.",
  descriptionUr: "ضلع میں ایمبولینس کی سہولت فراہم کرنے والی سروس۔",
  sourceUrl: "https://partner.example.org/ambulance",
  sourceTitle: "Partner page",
  coverage: ["Punjab"],
};
const post = (body: unknown, headers: Record<string, string> = {}) =>
  programsPOST(new Request("http://localhost/api/programs", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": freshIp(), ...headers } }), undefined);
const admin = { authorization: `Bearer ${ADMIN}`, "content-type": "application/json", "x-forwarded-for": "203.0.113.10" };

test("[REQ-SEC-022] a submission can never overwrite an existing service or publish itself, whatever the client claims", async () => {
  const real = listActiveServices()[0];
  const before = JSON.stringify(findServiceById(real.id));

  // The old endpoint did INSERT OR REPLACE with the caller's id, active flag and authority tier.
  const response = await post({ ...valid, id: real.id, active: true, sourceAuthorityTier: 1, sourceUrl: "https://phishing.example.net/login" });
  assert.equal(response.status, 202);
  const body = await response.json();
  assert.equal(body.status, "pending_review");
  assert.match(body.id, /^submission-[0-9a-f-]{36}$/);
  assert.notEqual(body.id, real.id);

  assert.equal(JSON.stringify(findServiceById(real.id)), before, "the real service is untouched");
  assert.equal(findServiceById(body.id), undefined, "a pending submission is invisible to citizens and the assistant");
  assert.ok(!listActiveServices().some((service) => service.id === body.id));

  const row = getSqlite().prepare("SELECT active, source_authority_tier FROM services WHERE id = ?").get(body.id) as { active: number; source_authority_tier: number };
  assert.equal(row.active, 0);
  assert.equal(row.source_authority_tier, 5, "client-claimed authority is ignored");
});

test("[REQ-SEC-022] source and procedure URLs must be public https links (no javascript:, http, IP literals, internal names, credentials)", async () => {
  for (const sourceUrl of ["javascript:alert(1)", "http://partner.example.org/x", "https://127.0.0.1/admin", "https://localhost/x", "https://intranet/x", "https://user:pw@partner.example.org/", "https://[::1]/", "data:text/html,hi", "ftp://partner.example.org/x"]) {
    const response = await post({ ...valid, sourceUrl });
    assert.equal(response.status, 400, sourceUrl);
  }
  const badStep = await post({ ...valid, procedure: [{ order: 1, title: "Apply", titleUr: "اپلائی", description: "Go to the page", descriptionUr: "صفحے پر جائیں", channel: "online", url: "javascript:alert(1)" }] });
  assert.equal(badStep.status, 400);
});

test("[REQ-SEC-022] submissions are size-capped, schema-strict and control characters are refused", async () => {
  assert.equal((await post({ ...valid, description: "x".repeat(5000) })).status, 400);
  assert.equal((await post({ ...valid, name: "A\u0000B scholarship" })).status, 400);
  assert.equal((await post({ ...valid, name: "Trusted \u202Egnp.exe" })).status, 400);
  assert.equal((await post({ ...valid, aliases: Array.from({ length: 30 }, (_, index) => `alias ${index}`) })).status, 400);
  assert.equal((await post({ ...valid, domain: "banking" })).status, 400);
  assert.equal((await post({ ...valid, name: "x" })).status, 400);
  const huge = await programsPOST(new Request("http://localhost/api/programs", { method: "POST", body: JSON.stringify({ ...valid, description: "y".repeat(200_000) }), headers: { "content-type": "application/json", "x-forwarded-for": freshIp() } }), undefined);
  assert.equal(huge.status, 413);
});

test("[REQ-SEC-022] the review queue is bounded and submissions are rate limited per client", async () => {
  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "1", RAAHI_ADMIN_SECRET: ADMIN }));
  const statuses: number[] = [];
  for (let index = 0; index < 6; index++) statuses.push((await post({ ...valid, name: `Rate test ${index}` }, { "x-forwarded-for": "192.0.2.77" })).status);
  assert.ok(statuses.includes(429), `no throttling: ${statuses}`);
  assert.equal(statuses[0], 202);

  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "100", RAAHI_ADMIN_SECRET: ADMIN }));
  const { submitService, pendingSubmissionCount } = await import("@/lib/db/repositories/services");
  const { SUBMISSION_PREFIX } = await import("@/lib/db/repositories/services");
  while (pendingSubmissionCount() < MAX_PENDING_SUBMISSIONS) assert.ok(submitService({ ...valid, aliases: [], eligibilityRules: [], requiredDocuments: [], procedure: [], namePs: "", applicationMethod: "online", lastVerified: "2026-10-15" } as never));
  assert.equal((await post(valid)).status, 503, "a full queue refuses new submissions instead of growing without bound");
  assert.ok(SUBMISSION_PREFIX.length > 0);
  getSqlite().prepare("DELETE FROM services WHERE id LIKE 'submission-%'").run();
});

test("[REQ-SEC-022] moderation: only the administrator can list, approve (at a chosen tier) or reject", async () => {
  getSqlite().prepare("DELETE FROM services WHERE id LIKE 'submission-%'").run();
  const created = await (await post({ ...valid, name: "Moderation target" })).json();
  const id = created.id as string;

  const call = (headers: Record<string, string>) => submissionsGET(new Request("http://localhost/api/v1/admin/submissions", { headers }));
  assert.equal((await call({ "x-forwarded-for": "203.0.113.11" })).status, 401);
  assert.equal((await call({ authorization: "Bearer not-the-admin-secret-at-all-123456", "x-forwarded-for": "203.0.113.11" })).status, 401);
  const listed = await (await call(admin)).json();
  assert.ok(listed.data.some((entry: { id: string }) => entry.id === id));

  const review = (body: unknown, headers: Record<string, string> = admin, target = id) =>
    reviewPOST(new Request(`http://localhost/api/v1/admin/submissions/${target}`, { method: "POST", body: JSON.stringify(body), headers }), { params: Promise.resolve({ id: target }) });
  assert.equal((await review({ decision: "approve", authorityTier: 3 }, { "content-type": "application/json", "x-forwarded-for": "203.0.113.12" })).status, 401);
  assert.equal((await review({ decision: "approve", authorityTier: 1 }, admin, "bisp-8171-core")).status, 400, "only submission ids can be reviewed");
  assert.equal((await review({ decision: "approve", authorityTier: 0 })).status, 422);
  assert.equal((await review({ decision: "explode" })).status, 422);

  const approved = await review({ decision: "approve", authorityTier: 2 });
  assert.equal(approved.status, 200);
  assert.equal((await approved.json()).status, "published");
  const published = findServiceById(id);
  assert.ok(published, "an approved submission becomes visible");
  assert.equal(published.sourceAuthorityTier, 2);
  assert.equal((await review({ decision: "approve", authorityTier: 2 })).status, 404, "it can only be approved once");

  const second = await (await post({ ...valid, name: "To be rejected" })).json();
  const rejected = await review({ decision: "reject" }, admin, second.id);
  assert.equal(rejected.status, 200);
  assert.equal(findServiceById(second.id), undefined);
  assert.equal(getSqlite().prepare("SELECT COUNT(*) AS n FROM services WHERE id = ?").get(second.id) && (getSqlite().prepare("SELECT COUNT(*) AS n FROM services WHERE id = ?").get(second.id) as { n: number }).n, 0, "a rejected submission is deleted");
});

test("[REQ-SEC-022] creating organisations is operator-only and 404 when the operator secret is not configured", async () => {
  const org = { id: "partner-ngo", name: "Partner NGO", nameUr: "پارٹنر این جی او", type: "ngo", sourceUrl: "https://partner.example.org/", authorityTier: 3 };
  const attempt = (headers: Record<string, string>) => organizationsPOST(new Request("http://localhost/api/organizations", { method: "POST", body: JSON.stringify(org), headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.20", ...headers } }), undefined);

  assert.equal((await attempt({})).status, 401);
  assert.equal((await attempt({ authorization: "Bearer wrong-secret-wrong-secret-wrong" })).status, 401);
  assert.equal((await organizationsGET(new Request("http://localhost/api/organizations"), undefined)).status, 200, "reading stays public");
  assert.equal((await attempt({ authorization: `Bearer ${ADMIN}` })).status, 201);

  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_RATE_LIMIT_SCALE: "100" }));
  assert.equal((await attempt({ authorization: `Bearer ${ADMIN}` })).status, 404, "no admin secret configured: the endpoint does not exist");
  assert.equal((await programsGET(new Request("http://localhost/api/programs"), undefined)).status, 200);
});
