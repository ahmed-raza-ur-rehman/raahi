import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.opps-chat.test.db");
delete process.env.DASHSCOPE_API_KEY;
process.env.OPPORTUNITIES_SNAPSHOT_URL = "off";

import { TOOLS, executeTool, getOrCreateConversation, runOrchestrator } from "@/lib/ai/orchestrator";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { opportunityIntent, type OpportunityToolResult } from "@/lib/ai/opportunity-tools";
import { seedDatabase } from "@/lib/db/seed";
import { setClock } from "@/lib/opportunities/clock";
import { searchResources } from "@/lib/opportunities/directory";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { loadSnapshotIntoDb, searchOpportunities } from "@/lib/opportunities/store";
import { allSourceRoutes, createFixtureHttp } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
setClock(() => NOW);

interface SseEvent {
  type: string;
  [key: string]: unknown;
}

async function ask(message: string, language = "en"): Promise<SseEvent[]> {
  const conversationId = getOrCreateConversation(`chat-test-${Math.random().toString(36).slice(2)}`);
  const events: SseEvent[] = [];
  for await (const chunk of runOrchestrator({ message, conversationId, sessionId: "chat-test", language })) {
    events.push(JSON.parse(chunk.replace(/^data: /, "").trim()) as SseEvent);
  }
  return events;
}

test("setup: seed the citizen-service catalog and load opportunities", async () => {
  seedDatabase();
  const snapshot = await runScrapers({ http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  loadSnapshotIntoDb(snapshot, NOW);
  assert.ok(searchOpportunities({}, NOW).total > 40);
  // Re-seeding the catalog must never wipe scraped opportunities.
  seedDatabase();
  assert.ok(searchOpportunities({}, NOW).total > 40, "seedDatabase() leaves the opportunity tables alone");
});

test("the assistant exposes the three opportunity tools next to the four citizen-service tools", () => {
  const names = TOOLS.map((tool) => tool.function.name);
  assert.deepEqual(names, ["search_knowledge", "check_eligibility", "create_case", "extract_profile", "search_opportunities", "find_resources", "check_offer_risk"]);
  for (const tool of TOOLS) assert.ok(tool.function.description.length > 40);
  assert.match(ORCHESTRATOR_SYSTEM_PROMPT, /NEVER invent a deadline/);
  assert.match(ORCHESTRATOR_SYSTEM_PROMPT, /BE&OE list of licensed OEPs/);
  assert.match(ORCHESTRATOR_SYSTEM_PROMPT, /never logs in to Udemy/i);
  assert.match(ORCHESTRATOR_SYSTEM_PROMPT, /citizen navigation assistant/i, "the original prompt is preserved");
});

test("search_opportunities returns compact cited records with freshness and no restricted listings", async () => {
  const result = JSON.parse(await executeTool("search_opportunities", { query: "commonwealth masters scholarship", kind: "scholarship" }, "s")) as OpportunityToolResult;
  assert.equal(result.found, true);
  assert.match(result.results[0].title, /Commonwealth/);
  assert.match(result.results[0].url, /^https:\/\//);
  assert.match(result.results[0].raahi_url, /^\/opportunities\/scholarshiptab-/);
  assert.equal(result.results[0].days_left, 9);
  assert.match(result.freshness, /refreshed about 0 hour/);
  assert.equal(result.generated_at, NOW.toISOString());
  assert.ok(result.results.length <= 6);

  const africa = JSON.parse(await executeTool("search_opportunities", { query: "mastercard foundation scholars", kind: "scholarship" }, "s")) as OpportunityToolResult;
  assert.ok(africa.results.every((item) => item.open_to_pakistan !== false), "listings restricted to other nationalities are hidden by default");

  const jobs = JSON.parse(await executeTool("search_opportunities", { query: "government jobs", scope: "pakistan", kind: "job", deadline_within_days: 12 }, "s")) as OpportunityToolResult;
  assert.ok(jobs.results.length > 0 && jobs.results.every((item) => item.days_left !== null && item.days_left <= 12));

  const none = JSON.parse(await executeTool("search_opportunities", { query: "zzzz qqqq", kind: "scholarship" }, "s")) as OpportunityToolResult;
  assert.equal(none.found, false);
  assert.match(none.note ?? "", /do not guess/);

  const badArgs = JSON.parse(await executeTool("search_opportunities", { query: 42, kind: "dragons", scope: 7, deadline_within_days: "soon" }, "s")) as OpportunityToolResult;
  assert.ok(badArgs.count >= 0, "malformed model arguments never crash the tool");
});

test("find_resources and check_offer_risk answer from the directory and the rule set", async () => {
  const resources = JSON.parse(await executeTool("find_resources", { query: "overseas employment agent verification", official_only: true }, "s")) as { found: boolean; results: Array<{ id: string; run_by: string; link_confirmed_on?: string }> };
  assert.ok(resources.found);
  assert.ok(resources.results.some((r) => r.id === "beoe-oep-list"));
  assert.ok(resources.results.every((r) => /government|institution/.test(r.run_by)));

  const risk = JSON.parse(await executeTool("check_offer_risk", { text: "Guaranteed Qatar visa, send advance fee via JazzCash to my personal account, WhatsApp only" }, "s")) as { risk_level: string; warning_signs: string[]; what_to_do: Array<{ url?: string }>; disclaimer: string };
  assert.equal(risk.risk_level, "high");
  assert.ok(risk.warning_signs.length >= 3);
  assert.ok(risk.what_to_do.some((entry) => entry.url?.includes("beoe.gov.pk")));
  assert.match(risk.disclaimer, /cannot confirm/);

  assert.deepEqual(JSON.parse(await executeTool("nonexistent_tool", {}, "s")), { error: "Unknown tool: nonexistent_tool" });
});

test("directory search lifts resources about the destination country", () => {
  const germany = searchResources({ q: "scholarships in germany" }).items.slice(0, 3).map((item) => item.id);
  assert.ok(germany.includes("daad"), `DAAD should lead for Germany, got ${germany.join(", ")}`);
  const uk = searchResources({ q: "scholarship uk" }).items.slice(0, 4).map((item) => item.id);
  assert.ok(uk.includes("chevening") || uk.includes("commonwealth-uk"));
});

test("intent detection routes opportunity questions, not citizen-service ones", () => {
  for (const yes of ["scholarships in germany", "I want a government job", "is this overseas agent genuine?", "free python course", "mdcat preparation", "سعودی عرب میں نوکری", "بیرون ملک اسکالرشپ", "ویزا کے لیے ایجنٹ", "CSS exam syllabus"]) {
    assert.equal(opportunityIntent(yes), true, yes);
  }
  for (const no of ["I need a domicile certificate", "میرے والد کو ڈائیلاسز چاہیے", "BISP registration", "ڈومیسائل سرٹیفکیٹ کیسے بنے", "my child needs school fee help", "سیلاب سے گھر متاثر ہوا ہے"]) {
    assert.equal(opportunityIntent(no), false, no);
  }
});

test("offline assistant (no API key) answers an opportunity question with cited cards and official portals", async () => {
  const events = await ask("سرکاری نوکری", "ur");
  const types = events.map((e) => e.type);
  assert.ok(types.includes("opportunity_results"));
  const cards = events.find((e) => e.type === "opportunity_results")!.results as Array<{ url: string; kind: string; raahi_url: string }>;
  assert.ok(cards.length > 0 && cards.every((card) => card.kind === "job" && card.url.startsWith("https://") && card.raahi_url.startsWith("/opportunities/")));
  assert.equal(types.at(-1), "done");
  const content = events.find((e) => e.type === "content")!.content as string;
  assert.match(content, /تصدیق/, "reminds the user to confirm on the official page (Urdu)");
});

test("offline assistant shows the scam warning before anything else when an offer looks risky", async () => {
  const events = await ask("Agent says Saudi visa guaranteed, pay Rs 200000 advance on JazzCash to his personal account, WhatsApp only", "en");
  const types = events.map((e) => e.type);
  assert.ok(types.includes("risk_result"));
  assert.ok(types.indexOf("risk_result") < types.indexOf("content"));
  const risk = events.find((e) => e.type === "risk_result")!.result as { level: string; advice: Array<{ url?: string }> };
  assert.equal(risk.level, "high");
  assert.ok(risk.advice.some((advice) => advice.url?.includes("beoe.gov.pk")));
  assert.match(events.find((e) => e.type === "content")!.content as string, /looks risky/);
  assert.ok(types.includes("resource_results"), "official verification portals are offered too");
  assert.ok(!types.includes("service"), "loosely matched citizen-service cards must not dilute a scam warning");
  const portals = events.find((e) => e.type === "resource_results")!.results as Array<{ id: string }>;
  assert.ok(portals.some((p) => p.id === "beoe-oep-list" || p.id === "beoe"), "the BE&OE verification route comes first");
});

test("offline assistant keeps answering citizen-service questions exactly as before", async () => {
  const events = await ask("I need a domicile certificate", "en");
  const types = events.map((e) => e.type);
  assert.ok(types.includes("service"));
  assert.ok(!types.includes("opportunity_results") && !types.includes("risk_result") && !types.includes("resource_results"));
  assert.equal(types.at(-1), "done");
});

test("emergencies still short-circuit before any opportunity logic", async () => {
  const events = await ask("my child is choking, also looking for a job", "en");
  assert.equal(events[0].type, "content");
  assert.equal(events[0].emergency, true);
  assert.deepEqual(events.map((e) => e.type), ["content", "done"]);
});
