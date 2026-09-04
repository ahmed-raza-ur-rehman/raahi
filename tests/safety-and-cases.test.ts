import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.safety.test.db");

import { detectSafetySignals } from "@/lib/safety/detect";
import { seedDatabase } from "@/lib/db/seed";
import { createCase, findCase, updateCase } from "@/lib/db/repositories/cases";

seedDatabase();

test("detects immediate danger before ordinary healthcare navigation", () => {
  assert.equal(detectSafetySignals("my child is choking").emergency, true);
  assert.equal(detectSafetySignals("میرے سینے میں درد ہے").emergency, true);
  assert.equal(detectSafetySignals("I need dialysis information").emergency, false);
});

test("persists a case and action completion for its session", () => {
  const sessionId = "safety-test-session";
  const item = createCase({ sessionId, title: "Test", titleUr: "ٹیسٹ", domain: "welfare", summary: "Test case", serviceIds: ["bisp-registration-route"], actions: [{ label: "Check", labelUr: "جانچیں" }] });
  assert.equal(findCase(item.id, sessionId)?.actions[0]?.completed, false);
  const updated = updateCase(item.id, sessionId, { actionId: item.actions[0].id, completed: true });
  assert.equal(updated?.actions[0]?.completed, true);
  assert.equal(findCase(item.id, "another-session"), undefined);
});