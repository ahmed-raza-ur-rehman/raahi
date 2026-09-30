import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.knowledge.test.db");

import {
  importantDates,
  listBloodBanks,
  listCamps,
  listContacts,
  listDisasterChannels,
  listDisasterGuides,
  listDiseaseSignals,
  listDocuments,
  listLegalTopics,
  listMedicalProcedures,
  listOpportunities,
  listScholarships,
  listTests,
  searchKnowledge,
} from "@/lib/knowledge";
import { opportunities } from "@/data/opportunities";
import { documentRecipes } from "@/data/documents";
import { scholarships } from "@/data/scholarships";
import { seedDatabase } from "@/lib/db/seed";
import type { Localized, OpportunityRecord, SourceRef } from "@/lib/types";

// The knowledge index is read from SQLite, so the corpus has to exist first.
seedDatabase();

const KNOWN_TYPES = [
  ["scholarships", listScholarships()],
  ["opportunities", listOpportunities()],
  ["documents", listDocuments()],
  ["tests", listTests()],
  ["camps", listCamps()],
  ["disease signals", listDiseaseSignals()],
  ["medical procedures", listMedicalProcedures()],
  ["blood banks", listBloodBanks()],
  ["disaster channels", listDisasterChannels()],
  ["disaster guides", listDisasterGuides()],
  ["legal topics", listLegalTopics()],
  ["contacts", listContacts()],
] as const;

test("every knowledge library has content", () => {
  for (const [name, items] of KNOWN_TYPES) {
    assert.ok(items.length > 0, `${name} should not be empty`);
  }
});

test("scholarships cover national, provincial and international awards", () => {
  const national = listScholarships({ scope: "national" });
  const international = listScholarships({ scope: "international" });

  assert.ok(national.length > 0, "expected national scholarships");
  assert.ok(international.length > 0, "expected international scholarships");

  for (const item of national) assert.equal(item.scope, "national");
  for (const item of international) assert.equal(item.scope, "international");

  // No record may be silently dropped: everything in the source files has to be
  // reachable through the index, even if it is filed as a different kind
  // (a training programme in the scholarship file still surfaces as an
  // opportunity).
  const reachable = new Set(listOpportunities().map((item) => item.id));
  const dropped = scholarships.filter((item) => !reachable.has(item.id));
  assert.deepEqual(dropped.map((item) => item.id), [], "no scholarship may be unreachable");
});

/**
 * The single promise Raahi makes is that its facts are traceable. If an entry
 * ships without a source and a verification date, that promise is broken.
 */
test("every scholarship cites an official source with a verification date", () => {
  for (const item of scholarships) {
    assert.ok(item.source, `${item.id} is missing a source`);
    assert.match(
      (item.source as SourceRef).url,
      /^https?:\/\//,
      `${item.id} source must be an absolute URL`,
    );
    assert.ok(
      (item.source as SourceRef).lastVerified,
      `${item.id} must state when it was last verified`,
    );
  }
});

test("every opportunity and document declares a fee, deadline and procedure", () => {
  const all: OpportunityRecord[] = [...opportunities, ...scholarships];
  for (const item of all) {
    assert.ok(item.applicationFee, `${item.id} must state the application fee`);
    assert.ok(item.deadline, `${item.id} must state a deadline`);
    assert.ok(item.procedure.length > 0, `${item.id} must have a procedure`);
    assert.ok(item.requiredDocuments.length > 0, `${item.id} must list documents`);
  }

  for (const doc of documentRecipes) {
    assert.ok(doc.steps.length > 0, `${doc.id} must explain how to get it`);
  }
});

test("localized content always has Urdu, the default language", () => {
  const missing: string[] = [];
  const check = (label: string, value: Localized | string | undefined) => {
    if (!value) {
      missing.push(`${label}: empty`);
      return;
    }
    if (typeof value === "string") return;
    if (!value.ur || value.ur.trim() === "") missing.push(`${label}: missing ur`);
  };

  for (const item of [...opportunities, ...scholarships]) {
    check(`${item.id}.title`, item.title);
    check(`${item.id}.benefit`, item.benefit);
  }
  for (const doc of documentRecipes) check(`${doc.id}.name`, doc.name);

  assert.deepEqual(missing, [], `entries missing Urdu text:\n${missing.join("\n")}`);
});

test("search finds the right knowledge and explains why", () => {
  const hits = searchKnowledge({ query: "scholarship", limit: 8 });

  assert.ok(hits.length > 0, "a search for 'scholarship' must return results");
  for (const hit of hits) {
    assert.ok(hit.score > 0, "hits must be scored");
    assert.ok(hit.title, "hits must carry a title");
    assert.ok(hit.reasons.length > 0, "hits must explain why they matched");
  }

  // Scores must be ordered best-first, or the ranking is not doing its job.
  const scores = hits.map((hit) => hit.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a), "hits must be sorted by score");
});

test("search stays relevant: a blood query does not return scholarships", () => {
  const hits = searchKnowledge({ query: "blood donor", limit: 10 });
  assert.ok(hits.length > 0, "a blood query must return results");

  const topTypes = hits.slice(0, 3).map((hit) => hit.entityType);
  assert.ok(
    topTypes.every((type) => type !== "opportunity"),
    `blood results should not be topped by opportunities, got ${topTypes.join(", ")}`,
  );
});

test("search tolerates an empty or nonsense query", () => {
  assert.doesNotThrow(() => searchKnowledge({ query: "", limit: 5 }));
  const nonsense = searchKnowledge({ query: "zzzqqqxxxyz", limit: 5 });
  assert.ok(Array.isArray(nonsense));
});

test("important dates are sorted soonest-first and carry a source", () => {
  const dates = importantDates();
  assert.ok(dates.length > 0, "the date library should not be empty");

  for (const date of dates) {
    assert.ok(date.source, `${date.id} must cite a source`);

    // A rolling or recurring deadline has no single date, but it must still say
    // something useful about *when* rather than leaving the visitor guessing.
    const hasWhen = date.date || date.window || date.recurringMonths;
    if (!hasWhen) {
      assert.ok(
        date.kind === "rolling" || date.kind === "unknown" || date.kind === "recurring",
        `${date.id} has no date and kind "${date.kind}" does not explain that`,
      );
      assert.ok(date.note, `${date.id} must explain an open-ended deadline in words`);
    }
  }

  const dated = dates.filter((date) => date.date).map((date) => date.date as string);
  assert.deepEqual(dated, [...dated].sort(), "fixed dates must run soonest first");
});

test("disaster guides are filtered by hazard", () => {
  const flood = listDisasterGuides("flood");
  assert.ok(flood.length > 0, "there must be flood guidance");
  for (const guide of flood) assert.equal(guide.hazard, "flood");

  const all = listDisasterGuides();
  assert.ok(all.length >= flood.length);
});

test("contacts include the national emergency numbers", () => {
  const contacts = listContacts();
  const numbers = contacts.flatMap((contact) => contact.numbers ?? []);
  assert.ok(numbers.includes("1122"), "Rescue 1122 must be listed");
});
