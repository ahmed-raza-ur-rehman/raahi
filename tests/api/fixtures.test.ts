import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { z } from "zod";
import * as S from "@/lib/api/v1/schemas";
import { leadingZeroBits, powDigest } from "@/lib/platform/auth/pow";

const read = (name: string): unknown => JSON.parse(readFileSync(join(process.cwd(), "contract", "v1", name), "utf8"));
const parse = <T extends z.ZodType>(schema: T, name: string): z.output<T> => {
  const result = schema.safeParse(read(name));
  assert.ok(result.success, `${name} does not match its schema: ${result.success ? "" : JSON.stringify(result.error.issues.slice(0, 3))}`);
  return result.data;
};

test("[REQ-API-007] the committed contract fixtures are current (run `npm run contract:write` after changing the API)", () => {
  const output = execFileSync(process.execPath, ["--import", "tsx", "scripts/contract-fixtures.ts", "--check"], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_ENV: "test" } });
  assert.match(output, /up to date/);
});

test("[REQ-API-007] every golden fixture validates against the v1 response schemas", () => {
  parse(S.listResponse, "opportunities.list.json");
  parse(S.listResponse, "opportunities.list.next.json");
  parse(S.detailResponse, "opportunities.detail.json");
  parse(S.programmeListResponse, "programmes.list.json");
  parse(S.programmeListResponse, "programmes.list.ur.json");
  parse(S.programmeDetailResponse, "programmes.detail.json");
  parse(S.guideListResponse, "guides.list.json");
  parse(S.guideDetailResponse, "guides.detail.json");
  parse(S.resourceListResponse, "resources.list.json");
  parse(z.object({ request: S.scamRequest, response: S.scamResponse }), "tools.scam-check.json");
  parse(z.object({ request: S.ageRequest, response: S.ageResponse }), "tools.age-check.json");
  for (const name of ["unknown-parameter", "validation-failed", "unauthorized", "token-expired"]) parse(S.problemSchema, `problems.${name}.json`);
  parse(z.object({ headers: z.object({ "Retry-After": z.string() }).loose(), body: S.problemSchema }), "problems.rate-limited.json");
  parse(S.manifestResponse, "sync/manifest.v1.json");
  parse(S.manifestResponse, "sync/manifest.v2.json");
  parse(z.array(S.opportunitySchema), "sync/items.v1.json");
  parse(z.array(S.opportunitySchema), "sync/items.v2.json");
});

test("[REQ-API-009] the sync scenario is coherent: manifests match their items and v1 -> v2 needs exactly the documented changes", () => {
  const v1 = parse(z.array(S.opportunitySchema), "sync/items.v1.json");
  const v2 = parse(z.array(S.opportunitySchema), "sync/items.v2.json");
  const m1 = parse(S.manifestResponse, "sync/manifest.v1.json");
  const m2 = parse(S.manifestResponse, "sync/manifest.v2.json");
  const scenario = read("sync/README.json") as { removedIds: string[]; changedIds: string[]; addedIds: string[]; unchangedCount: number };

  assert.deepEqual(m1.data, v1.map(({ id, rev }) => ({ id, rev })));
  assert.deepEqual(m2.data, v2.map(({ id, rev }) => ({ id, rev })));
  assert.equal(m1.meta.count, m1.data.length);

  const before = new Map(m1.data.map((entry) => [entry.id, entry.rev]));
  const after = new Map(m2.data.map((entry) => [entry.id, entry.rev]));
  const toFetch = [...after].filter(([id, rev]) => before.get(id) !== rev).map(([id]) => id).sort();
  const toDelete = [...before.keys()].filter((id) => !after.has(id)).sort();
  assert.deepEqual(toFetch, [...scenario.changedIds, ...scenario.addedIds].sort());
  assert.deepEqual(toDelete, [...scenario.removedIds].sort());
  assert.equal([...after].filter(([id, rev]) => before.get(id) === rev).length, scenario.unchangedCount);
  assert.ok(v2.find((item) => item.id === scenario.changedIds[0])?.title.endsWith("(updated)"));
});

test("[REQ-AND-007] age vectors are internally consistent (the Kotlin client must reproduce every one)", () => {
  const vectors = read("vectors/age.json") as Array<{ input: { dob: string; asOn: string }; expected: { age: { years: number; months: number; days: number } } | null }>;
  assert.ok(vectors.length >= 70);
  const valid = vectors.filter((vector) => vector.expected);
  assert.ok(valid.length > 60 && vectors.some((vector) => vector.expected === null), "include both valid and rejected inputs");
  for (const { input, expected } of valid) {
    assert.ok(expected && expected.age.months >= 0 && expected.age.months <= 11 && expected.age.days >= 0 && expected.age.days <= 31, JSON.stringify(input));
  }
  assert.ok(vectors.some((vector) => vector.input.dob.endsWith("-02-29")), "leap-day birthdays are covered");
  assert.ok(vectors.some((vector) => vector.input.dob.endsWith("-01-31")), "month-end borrowing is covered");
});

test("[REQ-AND-007] deadline-status vectors cover the Pakistan-time midnight boundary", () => {
  const vectors = read("vectors/status.json") as Array<{ now: string; deadline: string | null; rolling: boolean; expected: { status: string; daysLeft: number | null } }>;
  const at = (now: string, deadline: string) => vectors.find((vector) => vector.now === now && vector.deadline === deadline && !vector.rolling)?.expected;
  assert.deepEqual(at("2026-10-15T18:59:59Z", "2026-10-15"), { status: "closing-soon", daysLeft: 0 }, "23:59:59 in Pakistan is still the same day");
  assert.deepEqual(at("2026-10-15T19:00:00Z", "2026-10-15"), { status: "closed", daysLeft: -1 }, "midnight in Pakistan flips the day");
  assert.equal(at("2026-10-15T00:00:00Z", "2026-10-22")?.status, "closing-soon");
  assert.equal(at("2026-10-15T00:00:00Z", "2026-10-23")?.status, "open");
  assert.deepEqual(vectors.find((vector) => vector.deadline === null && vector.rolling)?.expected, { status: "rolling", daysLeft: null });
  assert.deepEqual(vectors.find((vector) => vector.deadline === null && !vector.rolling)?.expected, { status: "unknown", daysLeft: null });
});

test("[REQ-AND-003] proof-of-work vectors: each nonce is the smallest that satisfies its difficulty", () => {
  const { vectors, bits } = read("vectors/pow.json") as { vectors: Array<{ salt: string; difficulty: number; nonce: number; digestHex: string }>; bits: Array<{ hex: string; bits: number }> };
  assert.ok(vectors.length >= 12);
  for (const vector of vectors) {
    const digest = powDigest(vector.salt, vector.nonce);
    assert.equal(digest.toString("hex"), vector.digestHex);
    assert.ok(leadingZeroBits(digest) >= vector.difficulty);
    for (let smaller = 0; smaller < Math.min(vector.nonce, 4000); smaller++) {
      assert.ok(leadingZeroBits(powDigest(vector.salt, smaller)) < vector.difficulty, `${vector.salt}: ${smaller} is a smaller solution`);
    }
  }
  for (const { hex, bits: expected } of bits) assert.equal(leadingZeroBits(Buffer.from(hex, "hex")), expected, hex);
});
