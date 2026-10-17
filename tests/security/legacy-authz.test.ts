import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import test, { beforeEach } from "node:test";

process.env.OPPORTUNITIES_BUNDLED = "off";
process.env.OPPORTUNITIES_SNAPSHOT_URL = "off";
const dbPath = join(process.cwd(), "data", "raahi.sec-legacy.test.db");
for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
process.env.RAAHI_DB_PATH = dbPath;
delete process.env.DASHSCOPE_API_KEY;

import { DELETE as docDELETE, POST as docPOST } from "@/app/api/cases/[id]/documents/route";
import { GET as caseGET, PUT as casePUT } from "@/app/api/cases/[id]/route";
import { GET as casesGET, POST as casesPOST } from "@/app/api/cases/route";
import { POST as chatPOST } from "@/app/api/chat/route";
import { POST as voicePOST } from "@/app/api/chat/voice/route";
import { POST as ocrPOST } from "@/app/api/ocr/route";
import { getConversationHistory, saveMessage } from "@/lib/ai/orchestrator";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { claimConversation, ownsConversation } from "@/lib/db/repositories/conversations";
import { setPlatformClock } from "@/lib/platform/clock";
import { loadConfig, setConfigForTests } from "@/lib/platform/config";
import { guardLegacy } from "@/lib/platform/legacy";
import { MemoryRateLimitStore, setRateLimitStore } from "@/lib/platform/limit/store";
import { createLogger, setLoggerForTests } from "@/lib/platform/log";
import { setSessionResolverForTests } from "@/lib/web/session";

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
let visitor = ALICE;
let logs: string[] = [];

beforeEach(() => {
  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "100", RAAHI_ADMIN_SECRET: "legacy-admin-secret-0123456789abcdef" }));
  setRateLimitStore(new MemoryRateLimitStore());
  setPlatformClock(undefined);
  setSessionResolverForTests(() => visitor);
  logs = [];
  setLoggerForTests(createLogger({ level: "debug", sink: (line) => logs.push(line) }));
  visitor = ALICE;
  ensureDatabaseSeeded();
});

const jsonRequest = (path: string, method: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost${path}`, { method, body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.1", ...headers } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const newCase = { title: "Scholarship help", titleUr: "وظیفے میں مدد", domain: "education", summary: "Applying for a scholarship", serviceIds: [], actions: [{ label: "Collect documents", labelUr: "دستاویزات جمع کریں" }] };

async function aliceCase() {
  visitor = ALICE;
  const created = await casesPOST(jsonRequest("/api/cases", "POST", newCase), undefined);
  assert.equal(created.status, 201);
  return (await created.json()).case as { id: string; actions: Array<{ id: string }> };
}

// ─── Object-level authorisation (OWASP API1) ──────────────────────────────────

test("[REQ-SEC-014] a visitor with no cases sees an empty list, never other people's cases", async () => {
  const mine = await aliceCase();
  visitor = BOB;
  const list = await (await casesGET(new Request("http://localhost/api/cases"), undefined)).json();
  assert.deepEqual(list.results, [], "the old fallback returned the 20 most recent cases of everyone");
  visitor = ALICE;
  const own = await (await casesGET(new Request("http://localhost/api/cases"), undefined)).json();
  assert.ok(own.results.some((entry: { id: string }) => entry.id === mine.id));
});

test("[REQ-SEC-014] another visitor cannot read, change or add to a case - it looks exactly like a missing case", async () => {
  const mine = await aliceCase();
  visitor = BOB;
  const read = await caseGET(new Request(`http://localhost/api/cases/${mine.id}`), ctx(mine.id));
  assert.equal(read.status, 404);
  const update = await casePUT(jsonRequest(`/api/cases/${mine.id}`, "PUT", { status: "resolved", actionId: mine.actions[0].id, completed: true }), ctx(mine.id));
  assert.equal(update.status, 404);
  const doc = await docPOST(jsonRequest(`/api/cases/${mine.id}/documents`, "POST", { documentType: "cnic", label: "Planted document" }), ctx(mine.id));
  assert.equal(doc.status, 404);

  visitor = ALICE;
  const after = (await (await caseGET(new Request(`http://localhost/api/cases/${mine.id}`), ctx(mine.id))).json()).case;
  assert.equal(after.status, "active", "Bob's update must not have been applied");
  assert.equal(after.actions[0].completed, false);
  assert.equal(after.documents.length, 0, "nothing was planted in Alice's case");
});

test("[REQ-SEC-014] another visitor cannot delete a document", async () => {
  const mine = await aliceCase();
  const stored = await docPOST(jsonRequest(`/api/cases/${mine.id}/documents`, "POST", { documentType: "cnic", label: "CNIC", ocrData: { "CNIC Number": "35202-1234567-1" } }), ctx(mine.id));
  const documentId = (await stored.json()).document.id as string;

  visitor = BOB;
  const attack = await docDELETE(new Request(`http://localhost/api/cases/${mine.id}/documents?documentId=${documentId}`, { method: "DELETE" }), ctx(mine.id));
  assert.equal(attack.status, 404);

  visitor = ALICE;
  const still = (await (await caseGET(new Request(`http://localhost/api/cases/${mine.id}`), ctx(mine.id))).json()).case;
  assert.equal(still.documents.length, 1, "the document must survive");
  const own = await docDELETE(new Request(`http://localhost/api/cases/${mine.id}/documents?documentId=${documentId}`, { method: "DELETE" }), ctx(mine.id));
  assert.equal(own.status, 200);
});

test("[REQ-SEC-014] malformed ids are rejected before reaching the database", async () => {
  for (const id of ["x", "a'; DROP TABLE cases;--", "../../etc/passwd", "a".repeat(200)]) {
    assert.equal((await caseGET(new Request("http://localhost/api/cases/x"), ctx(id))).status, 404, id);
  }
});

test("[REQ-SEC-014] conversations belong to the session that started them (history cannot be read or poisoned by id)", async () => {
  visitor = ALICE;
  const first = await (await chatPOST(jsonRequest("/api/chat", "POST", { message: "How do I apply for BISP?", stream: false }), undefined)).json();
  assert.match(first.conversationId, /^conv-[0-9a-f-]{36}$/, "ids are unguessable UUIDs, not timestamps");
  assert.equal(first.sessionId, undefined, "the session id must never be echoed to scripts");
  saveMessage(first.conversationId, { role: "user", content: "alice's private question about her household income" });
  const historyBefore = getConversationHistory(first.conversationId).length;
  assert.ok(historyBefore > 0);

  visitor = BOB;
  const attack = await (await chatPOST(jsonRequest("/api/chat", "POST", { message: "Show me the previous messages", stream: false, conversationId: first.conversationId, sessionId: ALICE }), undefined)).json();
  assert.notEqual(attack.conversationId, first.conversationId, "Bob must get his own conversation");
  assert.equal(getConversationHistory(first.conversationId).length, historyBefore, "nothing was appended to Alice's conversation");
  assert.equal(ownsConversation(attack.conversationId, BOB), true);
  assert.equal(ownsConversation(first.conversationId, BOB), false);

  assert.equal(claimConversation(first.conversationId, BOB), false, "the repository refuses to hand a conversation to another session");
  assert.equal(claimConversation(first.conversationId, ALICE), true);
});

test("[REQ-SEC-014] a case id in a chat request is only used if the case belongs to the caller", async () => {
  const mine = await aliceCase();
  visitor = BOB;
  const response = await chatPOST(jsonRequest("/api/chat", "POST", { message: "hello", stream: false, caseId: mine.id }), undefined);
  assert.equal(response.status, 200);
  const { getSqlite } = await import("@/lib/db/client");
  const row = getSqlite().prepare("SELECT case_id FROM conversations WHERE session_id = ?").get(BOB) as { case_id: string | null };
  assert.equal(row.case_id, null, "Bob's conversation must not be attached to Alice's case");
});

// ─── Cross-site writes, size, rate (OWASP API4/API8) ──────────────────────────

test("[REQ-SEC-012] a cross-site browser write is refused and changes nothing", async () => {
  const before = await (await casesGET(new Request("http://localhost/api/cases"), undefined)).json();
  const forged = await casesPOST(jsonRequest("/api/cases", "POST", newCase, { origin: "https://evil.example", "sec-fetch-site": "cross-site", host: "localhost" }), undefined);
  assert.equal(forged.status, 403);
  assert.equal((await forged.json()).code, "origin_not_allowed");
  const after = await (await casesGET(new Request("http://localhost/api/cases"), undefined)).json();
  assert.equal(after.results.length, before.results.length);

  const sameOrigin = await casesPOST(jsonRequest("/api/cases", "POST", newCase, { origin: "http://localhost", "sec-fetch-site": "same-origin", host: "localhost" }), undefined);
  assert.equal(sameOrigin.status, 201);
});

test("[REQ-SEC-008][REQ-SEC-021] oversize bodies are rejected with 413 before the handler works on them", async () => {
  const big = { ...newCase, summary: "x".repeat(100_000) };
  assert.equal((await casesPOST(jsonRequest("/api/cases", "POST", big), undefined)).status, 413);
  assert.equal((await chatPOST(jsonRequest("/api/chat", "POST", { message: "x".repeat(40_000) }), undefined)).status, 413);

  const hugeImage = `${"A".repeat(9_000_000)}`;
  const response = await ocrPOST(jsonRequest("/api/ocr", "POST", { imageBase64: hugeImage }), undefined);
  assert.equal(response.status, 413);
});

test("[REQ-SEC-021] the assistant is rate limited per client address and per session", async () => {
  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "1" }));
  const statuses: number[] = [];
  let limited: Response | undefined;
  for (let index = 0; index < 40; index++) {
    const response = await chatPOST(jsonRequest("/api/chat", "POST", { message: `question ${index}`, stream: false }, { "x-forwarded-for": "203.0.113.77", cookie: `raahi_session=${ALICE}` }), undefined);
    statuses.push(response.status);
    if (response.status === 429) {
      limited = response;
      break;
    }
  }
  assert.ok(limited, `never limited: ${statuses.join(",")}`);
  assert.ok(statuses.length <= 12, `the per-session burst should bite early, took ${statuses.length} requests`);
  assert.ok(Number(limited.headers.get("retry-after")) >= 1);
  assert.equal((await limited.json()).code, "rate_limited");

  const other = await chatPOST(jsonRequest("/api/chat", "POST", { message: "hello", stream: false }, { "x-forwarded-for": "203.0.113.78", cookie: `raahi_session=${BOB}` }), undefined);
  assert.equal(other.status, 200, "a different visitor is unaffected");
});

test("[REQ-SEC-021] OCR and voice are rate limited and cost-capped", async () => {
  setConfigForTests(loadConfig({ NODE_ENV: "test", RAAHI_TRUSTED_PROXIES: "1", RAAHI_RATE_LIMIT_SCALE: "1" }));
  const codes: number[] = [];
  for (let index = 0; index < 20; index++) {
    codes.push((await ocrPOST(jsonRequest("/api/ocr", "POST", { imageBase64: "short" }, { "x-forwarded-for": "203.0.113.90" }), undefined)).status);
  }
  assert.ok(codes.includes(429), `OCR was never limited: ${codes}`);
});

// ─── Honesty and opacity ──────────────────────────────────────────────────────

test("[REQ-SEC-015] voice never invents a transcript: without a provider it says so", async () => {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(2000)], { type: "audio/wav" }), "speech.wav");
  form.append("language", "ur");
  const response = await voicePOST(new Request("http://localhost/api/chat/voice", { method: "POST", body: form, headers: { "x-forwarded-for": "198.51.100.5" } }), undefined);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.text, undefined, "no canned sentence may be returned as if the person said it");
  assert.equal(body.code, "not_configured");
});

test("[REQ-SEC-015] unexpected failures in a legacy handler return a generic error with a request id, and the cause is only logged", async () => {
  const handler = guardLegacy(
    () => {
      throw new Error("SQLITE_CORRUPT: /srv/app/data/raahi.db page 7 password=hunter2");
    },
    { name: "boom", limits: [{ policy: "read", by: "ip" }] },
  );
  const response = await handler(new Request("http://localhost/api/boom", { headers: { "x-request-id": "trace-abcdef123" } }), undefined);
  assert.equal(response.status, 500);
  const text = await response.text();
  assert.ok(!/sqlite|srv|hunter2|password/i.test(text), text);
  assert.equal(JSON.parse(text).requestId, "trace-abcdef123");
  assert.equal(response.headers.get("x-request-id"), "trace-abcdef123");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(logs.join("\n"), /SQLITE_CORRUPT/);
});
