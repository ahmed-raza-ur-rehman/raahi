import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { analyse, scanTests } from "../../scripts/traceability";

function fixture(requirements: string, tests: Record<string, string>, evidence: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), "raahi-trace-"));
  mkdirSync(join(root, "docs", "requirements"), { recursive: true });
  writeFileSync(join(root, "docs", "requirements", "requirements.yaml"), requirements);
  for (const [path, content] of Object.entries({ ...Object.fromEntries(Object.entries(tests).map(([name, body]) => [`tests/${name}`, body])), ...evidence })) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

const header = "areas:\n  API: Api\n  SEC: Security\nrequirements:\n";
const requirement = (id: string, extra = "") =>
  `  - id: ${id}\n    title: Example title\n    statement: The system shall do something that can be verified by a test.\n    type: functional\n    priority: must\n    status: implemented\n    verification: [test]\n${extra}`;

test("REQ-DOC-007 the real registry has no gaps and the committed traceability document is current", () => {
  const result = analyse(process.cwd());
  assert.deepEqual(result.problems, []);
  assert.ok(result.requirements.length >= 60);
  assert.ok(result.tests.length >= 450, `only ${result.tests.length} tests scanned (TypeScript and Kotlin)`);
  assert.equal(readFileSync(join(process.cwd(), "docs", "requirements", "traceability.md"), "utf8"), result.markdown, "run `npm run trace` and commit docs/requirements/traceability.md");
});

test("REQ-DOC-007 the scanner reads test titles from both TypeScript and Kotlin sources", () => {
  const root = fixture(`${header}${requirement("REQ-API-001")}`, { "a.test.ts": 'test("REQ-API-001 something works", () => {});\nit(`REQ-API-001 and REQ-SEC-002 template`, () => {});' }, {
    "android/core/x/src/test/kotlin/X.kt": "class X {\n  @Test\n  fun `REQ-API-001 kotlin title`() {}\n  fun helperNotATest() {}\n}\n",
  });
  const titles = scanTests(root);
  assert.equal(titles.length, 3);
  assert.deepEqual(titles.flatMap((entry) => entry.ids).sort(), ["REQ-API-001", "REQ-API-001", "REQ-API-001", "REQ-SEC-002"]);
});

test("REQ-DOC-007 a requirement nobody tests is reported", () => {
  const root = fixture(`${header}${requirement("REQ-API-001")}${requirement("REQ-API-002")}`, { "a.test.ts": 'test("REQ-API-001 only the first", () => {});' });
  assert.deepEqual(analyse(root).problems, ["REQ-API-002: implemented but no test cites it"]);
});

test("REQ-DOC-007 a test citing an unknown requirement is reported, so typos and deleted requirements cannot hide", () => {
  const root = fixture(`${header}${requirement("REQ-API-001")}`, { "a.test.ts": 'test("REQ-API-001 ok", () => {});\ntest("REQ-API-099 typo", () => {});' });
  const problems = analyse(root).problems;
  assert.equal(problems.length, 1);
  assert.match(problems[0], /unknown requirement REQ-API-099/);
});

test("REQ-DOC-007 evidence-based verification needs files that exist, and a planned requirement needs a note", () => {
  const evidenceBased = (file: string) => `  - id: REQ-SEC-001\n    title: Documented\n    statement: The system shall be documented somewhere reviewable.\n    type: security\n    priority: must\n    status: implemented\n    verification: [inspection]\n    evidence: [${file}]\n`;
  assert.deepEqual(analyse(fixture(`${header}${evidenceBased("docs/missing.md")}`, {})).problems, ["REQ-SEC-001: evidence file docs/missing.md does not exist"]);
  assert.deepEqual(analyse(fixture(`${header}${evidenceBased("docs/there.md")}`, {}, { "docs/there.md": "# here" })).problems, []);
  const planned = `  - id: REQ-API-001\n    title: Planned thing\n    statement: The system shall do a thing that is not built yet.\n    type: functional\n    priority: could\n    status: planned\n    verification: [test]\n`;
  assert.deepEqual(analyse(fixture(`${header}${planned}`, {})).problems, ["REQ-API-001: a planned requirement needs a note saying when and why"]);
});

test("REQ-DOC-007 malformed registries fail loudly: bad id, unknown area, duplicate, unknown method, vague statement", () => {
  const bad = `${header}  - id: REQ-API-001\n    title: Vague\n    statement: short\n    type: functional\n    priority: must\n    status: implemented\n    verification: [telepathy]\n${requirement("REQ-ZZZ-002")}${requirement("REQ-API-001")}${requirement("api-3")}`;
  const problems = analyse(fixture(bad, { "a.test.ts": 'test("REQ-API-001 x", () => {});\ntest("REQ-ZZZ-002 x", () => {});' })).problems.join("\n");
  assert.match(problems, /REQ-API-001: duplicate id/);
  assert.match(problems, /REQ-ZZZ-002: area ZZZ is not declared/);
  assert.match(problems, /unknown verification method "telepathy"/);
  assert.match(problems, /too short to be verifiable/);
  assert.match(problems, /api-3: id must look like REQ-AREA-001/);
});
