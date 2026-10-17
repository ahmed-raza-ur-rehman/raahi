import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.OPPORTUNITIES_BUNDLED = "off";
process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.opps-spell.test.db");

import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { buildVocabulary, correctQuery, correctWord, editDistance, isKnown } from "@/lib/opportunities/spellfix";
import { loadSnapshotIntoDb, searchOpportunities } from "@/lib/opportunities/store";
import type { Snapshot } from "@/lib/opportunities/types";
import { allSourceRoutes, createFixtureHttp, fixtureSources } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
const VOCAB = buildVocabulary(["Scholarship scholarship scholarship", "Germany Germany", "Engineering Engineering", "Chevening", "Bangladesh", "Software Engineer"]);

test("edit distance: a swap of neighbouring letters is one edit", () => {
  assert.equal(editDistance("scholarhsip", "scholarship"), 1);
  assert.equal(editDistance("germny", "germany"), 1);
  assert.equal(editDistance("enginerng", "engineering"), 2);
  assert.equal(editDistance("same", "same"), 0);
});

test("a word that is known, or the start of a known word, is never 'corrected'", () => {
  assert.equal(isKnown("engin", VOCAB), true);
  assert.equal(correctWord("engineering", VOCAB), undefined);
  assert.equal(correctWord("engin", VOCAB), undefined);
  assert.equal(correctWord("chevening", VOCAB), undefined);
});

test("typical typing mistakes are fixed", () => {
  assert.equal(correctWord("scholrship", VOCAB), "scholarship");
  assert.equal(correctWord("scholarhsip", VOCAB), "scholarship");
  assert.equal(correctWord("germny", VOCAB), "germany");
  assert.equal(correctWord("enginerng", VOCAB), "engineering");
  assert.equal(correctWord("banglades", VOCAB), undefined, "a prefix of a known word is a word in progress, not a typo");
  assert.equal(correctWord("Scholrship", VOCAB), "scholarship", "case does not matter");
});

test("short words, far-off words and unlike first letters are left alone", () => {
  assert.equal(correctWord("cat", VOCAB), undefined, "three letters are too ambiguous");
  assert.equal(correctWord("xyzabc", VOCAB), undefined);
  assert.equal(correctWord("pngineerng", VOCAB), undefined, "two edits and a different first letter");
  assert.equal(correctWord("qqqqzzzz", VOCAB), undefined);
});

test("the more common word wins a tie", () => {
  const vocab = buildVocabulary(["master master master masker"]);
  assert.equal(correctWord("mastar", vocab), "master");
});

test("a whole query is corrected word by word and the rest is kept", () => {
  const fixed = correctQuery("Scholrship in Germny 2027", ["scholrship", "germny"], VOCAB);
  assert.deepEqual(fixed, { q: "scholarship in germany 2027", changes: [{ from: "scholrship", to: "scholarship" }, { from: "germny", to: "germany" }] });
  assert.equal(correctQuery("scholarship germany", ["scholarship", "germany"], VOCAB), undefined);
  assert.equal(correctQuery("zzzzzz", ["zzzzzz"], VOCAB), undefined);
});

// ─── Against the real store ──────────────────────────────────────────────────

let snapshot: Snapshot;

test("setup: load the offline fixtures into SQLite", async () => {
  snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  assert.ok(loadSnapshotIntoDb(snapshot, NOW).loaded > 40);
});

function mangle(word: string): string {
  const middle = Math.floor(word.length / 2);
  return `${word.slice(0, middle)}${word[middle + 1]}${word[middle]}${word.slice(middle + 2)}`; // swap two neighbouring letters
}

test("search: a mistyped word finds what the correct one would, and says what it changed", () => {
  const titleWord = snapshot.items
    .flatMap((item) => item.title.split(/[^\p{L}]+/u))
    .map((word) => word.toLowerCase())
    .find((word) => word.length >= 8 && searchOpportunities({ q: word }, NOW).total > 0 && word[Math.floor(word.length / 2)] !== word[Math.floor(word.length / 2) + 1]);
  assert.ok(titleWord, "the fixtures contain a long word that can be searched for");
  const typo = mangle(titleWord);
  assert.notEqual(typo, titleWord);

  const direct = searchOpportunities({ q: titleWord }, NOW);
  const result = searchOpportunities({ q: typo }, NOW);
  assert.ok(result.total > 0, `"${typo}" should find results`);
  assert.equal(result.interpreted.corrected?.from, typo);
  assert.equal(result.interpreted.corrected?.to, titleWord);
  assert.equal(result.total, direct.total);
});

test("search: no correction when the search already works, and none when nothing is close", () => {
  assert.equal(searchOpportunities({ q: "scholarship" }, NOW).interpreted.corrected, undefined);
  const nothing = searchOpportunities({ q: "qqqqzzzzwwww" }, NOW);
  assert.equal(nothing.total, 0);
  assert.equal(nothing.interpreted.corrected, undefined);
  assert.equal(searchOpportunities({}, NOW).interpreted.corrected, undefined, "browsing is never 'corrected'");
});

test("search: filters inferred from a corrected sentence still apply", () => {
  const result = searchOpportunities({ q: "scholrship" }, NOW);
  assert.ok(result.total > 0, "the fixtures contain scholarships");
  assert.deepEqual(result.interpreted.kinds, ["scholarship"]);
  assert.ok(result.items.every((item) => item.kind === "scholarship"));
  assert.equal(result.interpreted.corrected?.to, "scholarship");
});
