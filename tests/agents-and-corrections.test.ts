import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.agents.test.db");

import { seedDatabase } from "@/lib/db/seed";
import { AGENTS, routeAgents, runAgentWorkflow } from "@/lib/ai/agents";
import {
  correctionStats,
  getCorrection,
  listCorrections,
  reviewCorrection,
  submitCorrection,
  validateCorrection,
  voteCorrection,
} from "@/lib/knowledge/corrections";
import { pick } from "@/lib/i18n";

seedDatabase();

const SESSION = "test-session-agents";

/* ─────────────────────────── Agent routing ─────────────────────────── */

test("every agent is defined once and has a localised name", () => {
  const ids = AGENTS.map((agent) => agent.id);
  assert.equal(new Set(ids).size, ids.length, "agent ids must be unique");
  for (const agent of AGENTS) {
    assert.ok(agent.id, "every agent needs an id");
    assert.ok(pick(agent.name, "ur"), `${agent.id} needs an Urdu name`);
  }
});

test("a scholarship question routes to the scholarship agent", async () => {
  const routed = routeAgents("I need a scholarship for my daughter", "en");
  assert.ok(routed.length > 0);
  assert.equal(routed[0].agent.id, "scholarship", `got ${routed[0].agent.id}`);
});

test("a question about documents routes to the documents agent", async () => {
  const routed = routeAgents("How do I get my CNIC made?", "en");
  assert.equal(routed[0].agent.id, "documents", `got ${routed[0].agent.id}`);
});

test("a blood request routes to the blood agent", async () => {
  const routed = routeAgents("my father needs blood in hospital", "en");
  assert.equal(routed[0].agent.id, "blood", `got ${routed[0].agent.id}`);
});

test("routing returns scored candidates, best first", async () => {
  const routed = routeAgents("scholarship", "en");
  const scores = routed.map((entry) => entry.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "candidates must be ranked");
});

/* ─────────────────────── The workflow, offline ─────────────────────── */

test("the workflow answers a scholarship question with sourced hits", async () => {
  const response = await runAgentWorkflow({
    query: "scholarship for undergraduate students",
    language: "en",
    sessionId: SESSION,
  });

  assert.ok(response.answer.en, "an answer must be provided");
  assert.ok(response.hits.length > 0, "the answer must be grounded in the knowledge base");
  assert.ok(response.trace.length > 0, "the agent must explain what it did");
  assert.notEqual(response.emergency, true, "an ordinary question is not an emergency");
});

test("the workflow works without any API key configured", async () => {
  // This is the environment most deployments start in: no DashScope key.
  const response = await runAgentWorkflow({
    query: "how do I get a domicile certificate",
    language: "en",
    sessionId: SESSION,
  });
  assert.ok(response.answer.en.length > 0, "it must still answer");
  assert.ok(response.steps.length > 0, "it must still give steps");
});

test("an emergency short-circuits everything else", async () => {
  const response = await runAgentWorkflow({
    query: "someone is drowning, help",
    language: "en",
    sessionId: SESSION,
  });

  assert.equal(response.emergency, true, "emergencies must be flagged");
  assert.ok(response.contacts.length > 0, "emergency numbers must be shown");
  assert.ok(
    response.contacts.some((contact) => (contact.phone ?? "").includes("1122")),
    "Rescue 1122 must be among them",
  );
  assert.equal(response.hits.length, 0, "no ordinary results during an emergency");
});

test("answers are localised, not English-only", async () => {
  const urdu = await runAgentWorkflow({
    query: "scholarship",
    language: "ur",
    sessionId: SESSION,
  });
  assert.ok(urdu.answer.ur, "an Urdu answer must have Urdu text");
});

/* ───────────────────── Knowledge corrections ───────────────────── */

const validCorrection = {
  sessionId: SESSION,
  entityType: "scholarship",
  entityId: "sch-ehsaas-undergraduate",
  field: "fee",
  suggestedValue: "No fee",
  reportedValue: "Rs 500",
  reason: "The official portal says it is free.",
  evidenceUrl: "https://www.hec.gov.pk/",
};

test("a correction is validated before it enters the queue", () => {
  assert.equal(validateCorrection(validCorrection), undefined, "a complete correction must pass");

  assert.match(validateCorrection({ ...validCorrection, field: "  " }) ?? "", /which part/i);
  assert.match(validateCorrection({ ...validCorrection, suggestedValue: "x" }) ?? "", /what it should say/i);
  assert.match(
    validateCorrection({ ...validCorrection, evidenceUrl: "not-a-url" }) ?? "",
    /http/i,
  );
  assert.match(
    validateCorrection({ ...validCorrection, reporterContact: "abc" }) ?? "",
    /contact/i,
  );
});

test("a correction enters the review queue, not straight into the knowledge base", () => {
  const created = submitCorrection(validCorrection);

  assert.ok(created.id.startsWith("corr-"));
  assert.equal(created.status, "pending", "corrections must wait for review");
  assert.equal(getCorrection(created.id)?.suggestedValue, "No fee");

  const queued = listCorrections({ status: "pending" }).map((item) => item.id);
  assert.ok(queued.includes(created.id));
});

test("a correction can be up-voted and reviewed", () => {
  const created = submitCorrection(validCorrection);

  const voted = voteCorrection(created.id);
  assert.ok(voted);
  assert.ok((voted?.votes ?? 0) >= 1);

  const accepted = reviewCorrection(created.id, "accepted", "Checked against the portal.");
  assert.equal(accepted?.status, "accepted");

  const stats = correctionStats();
  assert.ok(stats.total >= 1);
});

test("reviewing an unknown correction does not throw", () => {
  assert.equal(reviewCorrection("corr-nope", "accepted"), undefined);
  assert.equal(voteCorrection("corr-nope"), undefined);
});
