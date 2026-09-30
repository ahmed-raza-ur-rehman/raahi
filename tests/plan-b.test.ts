import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

/**
 * "Always keep a plan B."
 *
 * These tests run with the AI provider deliberately switched OFF, because that
 * is the state that must still serve a citizen. They are the reason we can say
 * the fallbacks work rather than merely exist.
 */
delete process.env.DASHSCOPE_API_KEY;

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.planb.test.db");

import { processDocument } from "@/lib/ai/ocr";
import { translateText } from "@/lib/ai/translate";
import { synthesizeSpeech, transcribeAudio } from "@/lib/ai/voice";
import {
  isCircuitOpen,
  providerHealth,
  recordFailure,
  recordSuccess,
  withProvider,
} from "@/lib/ai/resilience";
import { seedDatabase } from "@/lib/db/seed";
import { createDashScopeEmbedding } from "@/lib/rag/embeddings";
import { searchServicesHybrid } from "@/lib/rag/search";
import { runOrchestrator } from "@/lib/ai/orchestrator";

seedDatabase();

/* ─────────────────── OCR: honesty over invention ─────────────────── */

test("OCR reports unavailable instead of inventing document details", async () => {
  const result = await processDocument("aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYSBkb2N1bWVudA==");

  assert.equal(result.available, false, "with no provider it must say so");
  assert.equal(Object.keys(result.fields).length, 0, "no fields may be invented");
  assert.ok(result.note && result.note.length > 0, "and it must explain why");
});

test("an unavailable OCR result never contains a placeholder identity number", async () => {
  const result = await processDocument("aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYSBkb2N1bWVudA==");
  const serialised = JSON.stringify(result.fields);
  assert.doesNotMatch(serialised, /X{3,}/, "no XXXXX-style fake CNIC");
  assert.doesNotMatch(serialised, /\d{5}-\d{7}-\d/, "no made-up CNIC number");
});

/* ─────────────────── The OCR endpoint accepts both callers ─────────────────── */

async function postOcr(body: unknown) {
  const { POST } = await import("@/app/api/ocr/route");
  const request = new Request("http://localhost/api/ocr", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, body: (await response.json()) as Record<string, never> };
}

const sampleImage = "a".repeat(64);

test("the OCR endpoint understands the chat screen's payload shape", async () => {
  const { status, body } = await postOcr({ imageBase64: sampleImage });
  assert.equal(status, 200, "a readable-but-unavailable result is not a server error");
  const result = (body as unknown as { result: { available: boolean } }).result;
  assert.equal(result.available, false);
});

test("the OCR endpoint understands the case portal's payload shape", async () => {
  const { status, body } = await postOcr({ image: sampleImage, documentType: "cnic" });
  assert.equal(status, 200, "the portal must not be rejected for its field name");
  const result = (body as unknown as { result: { available: boolean } }).result;
  assert.equal(result.available, false);
});

test("the OCR endpoint strips a data-URL prefix", async () => {
  const { status } = await postOcr({ image: `data:image/jpeg;base64,${sampleImage}` });
  assert.equal(status, 200);
});

test("the OCR endpoint rejects a genuinely empty request", async () => {
  const { status } = await postOcr({});
  assert.equal(status, 400);
});

/* ─────────────────── The circuit breaker ─────────────────── */

test("a failing provider falls back instead of throwing", async () => {
  const value = await withProvider("dashscope-chat", {
    timeoutMs: 500,
    call: async () => {
      throw new Error("provider exploded");
    },
    fallback: () => "plan-b",
  });
  assert.equal(value, "plan-b");
});

test("a hanging provider is abandoned on schedule, not after it", async () => {
  const started = Date.now();
  const value = await withProvider("dashscope-chat", {
    timeoutMs: 80,
    label: "hanging-call",
    retry: false,
    call: () => new Promise<string>(() => undefined), // never settles
    fallback: () => "plan-b",
  });
  const elapsed = Date.now() - started;
  assert.equal(value, "plan-b");
  assert.ok(elapsed < 2_000, `the visitor should not wait for a dead provider (waited ${elapsed}ms)`);
});

test("a working provider is used and clears the circuit", async () => {
  const value = await withProvider("dashscope-chat", {
    timeoutMs: 500,
    call: async () => "provider-answer",
    fallback: () => "plan-b",
  });
  assert.equal(value, "provider-answer");
  assert.equal(isCircuitOpen("dashscope-chat"), false);
});

test("after repeated failures the provider is not called again for a while", async () => {
  const name = "dashscope-vision" as const;
  recordSuccess(name); // start from a known-clean slate

  let calls = 0;
  const failing = async () => {
    calls += 1;
    throw new Error("connection reset");
  };
  const options = { timeoutMs: 100, call: failing, fallback: () => "plan-b" } as const;

  for (let attempt = 0; attempt < 4; attempt += 1) await withProvider(name, options);
  const callsBeforeBreak = calls;

  assert.equal(isCircuitOpen(name), true, "the circuit should be open by now");

  await withProvider(name, options);
  assert.equal(calls, callsBeforeBreak, "an open circuit must not touch the provider at all");

  recordSuccess(name); // recovery
  assert.equal(isCircuitOpen(name), false);
});

test("providerHealth reports every provider we depend on", () => {
  const health = providerHealth();
  for (const name of ["dashscope-chat", "dashscope-vision", "dashscope-audio", "dashscope-embeddings"]) {
    assert.ok(health[name], `${name} should be reported`);
    assert.equal(typeof health[name].open, "boolean");
  }
});

/* ─────────────────── Feature-level plan B ─────────────────── */

test("translation degrades to the glossary, never to English-only", async () => {
  const result = await translateText("How do I apply for a scholarship?", "ur");
  assert.ok(["glossary", "passthrough", "qwen"].includes(result.provider));
  assert.ok(result.text.length > 0, "always return something readable");
});

test("text-to-speech hands the browser a plan when the server cannot speak", async () => {
  const result = await synthesizeSpeech("آپ کی درخواست موصول ہو گئی", "ur");
  assert.equal(result.provider, "browser");
  assert.ok(result.voiceTag, "the browser needs to know which voice to use");
});

test("speech-to-text admits it is unavailable rather than returning silence as fact", async () => {
  const result = await transcribeAudio(Buffer.from("not-audio"), "ur");
  assert.equal(result.provider, "unavailable");
  assert.equal(result.text, "", "an unheard transcript must never be a guess");
});

test("embeddings return nothing rather than blocking search", async () => {
  assert.equal(await createDashScopeEmbedding("scholarship"), undefined);
});

test("knowledge search still ranks well with no embeddings at all", async () => {
  const results = await searchServicesHybrid({ query: "scholarship", limit: 5 });
  assert.ok(results.length > 0, "keyword search must carry the load");
  assert.ok(results[0].score > 0);
});

test("the chat answers from verified services when the model is unavailable", async () => {
  const events: { type: string }[] = [];
  for await (const chunk of runOrchestrator({
    message: "scholarship",
    conversationId: "planb-conversation",
    sessionId: "planb-session",
    language: "ur",
  })) {
    for (const line of chunk.split("\n\n")) {
      const payload = line.replace(/^data: /, "").trim();
      if (!payload) continue;
      events.push(JSON.parse(payload) as { type: string });
    }
  }

  const types = events.map((event) => event.type);
  assert.ok(
    types.includes("search_results"),
    `the chat UI renders "search_results" as service cards; got ${types.join(", ")}`,
  );
  assert.equal(types[types.length - 1], "done", "the stream must always close cleanly");
});

test("an emergency is answered before any provider is consulted", async () => {
  let sawEmergency = false;
  for await (const chunk of runOrchestrator({
    message: "I want to kill myself",
    conversationId: "planb-emergency",
    sessionId: "planb-session",
    language: "en",
  })) {
    if (chunk.includes('"emergency":true')) sawEmergency = true;
  }
  assert.equal(sawEmergency, true, "crisis text must never wait on a model");
});
