import assert from "node:assert/strict";
import test from "node:test";

import { services } from "@/data/catalog";
import { eligibilityEngine } from "@/lib/eligibility";

function service(id: string) {
  const record = services.find((item) => item.id === id);
  if (!record) throw new Error(`Missing fixture: ${id}`);
  return record;
}

test("marks fully matched deterministic rules as likely", () => {
  const result = eligibilityEngine.evaluate({
    service: service("bisp-taleemi-wazaif"),
    profile: {
      isBispBeneficiary: true,
      isEnrolled: true,
      age: 10,
    },
  });

  assert.equal(result.status, "likely");
  assert.equal(result.unmatchedRules.length, 0);
  assert.equal(result.missingInfo.length, 0);
});

test("never upgrades an official assessment to likely", () => {
  const result = eligibilityEngine.evaluate({
    service: service("bisp-kafaalat"),
    profile: {
      hasCnic: true,
      gender: "female",
      pmtScore: 20,
    },
  });

  assert.equal(result.status, "possible");
  assert.match(result.confidenceReason, /official assessment/i);
});

test("marks failed mandatory rules as unlikely", () => {
  const result = eligibilityEngine.evaluate({
    service: service("bisp-taleemi-wazaif"),
    profile: {
      isBispBeneficiary: false,
      isEnrolled: true,
      age: 10,
    },
  });

  assert.equal(result.status, "unlikely");
  assert.equal(result.unmatchedRules.length, 1);
});

test("reports missing profile information and documents separately", () => {
  const result = eligibilityEngine.evaluate({
    service: service("bisp-taleemi-wazaif"),
    profile: { isBispBeneficiary: true },
  });

  assert.equal(result.status, "possible");
  assert.equal(result.missingInfo.length, 2);
  assert.deepEqual(result.missingDocuments.sort(), ["CNIC", "School enrollment evidence"]);
});

test("supports every deterministic comparison operator", () => {
  assert.equal(eligibilityEngine.compare(4, "lt", 5), true);
  assert.equal(eligibilityEngine.compare(5, "lte", 5), true);
  assert.equal(eligibilityEngine.compare(6, "gt", 5), true);
  assert.equal(eligibilityEngine.compare(5, "gte", 5), true);
  assert.equal(eligibilityEngine.compare("Punjab", "eq", "Punjab"), true);
  assert.equal(eligibilityEngine.compare("Sindh", "in", ["Punjab", "Sindh"]), true);
  assert.equal(eligibilityEngine.compare(["flood_affected"], "in", ["flood_affected"]), true);
  assert.equal(eligibilityEngine.compare(18, "between", [4, 22]), true);
  assert.equal(eligibilityEngine.compare(false, "exists", true), true);
});
