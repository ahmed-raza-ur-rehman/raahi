/**
 * Requirements traceability, verified by machine.
 *
 *   npm run trace         regenerate docs/requirements/traceability.md
 *   npm run trace:check   fail on any gap or if the generated document is out of date (run in CI)
 *
 * Rules (see docs/requirements/requirements.yaml):
 *   1. ids are well formed, belong to a declared area and are unique;
 *   2. an implemented or partial requirement verified by `test` is cited in the title of at least one test
 *      (TypeScript `test("... REQ-API-001 ...")`, Kotlin `fun \`REQ-AND-001 ...\``);
 *   3. a requirement verified by inspection, analysis or demonstration lists evidence files that exist;
 *   4. a planned requirement explains why in `note`;
 *   5. no test cites an id that is not in the registry (typos and deleted requirements cannot hide).
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import YAML from "yaml";

export type Status = "implemented" | "partial" | "planned";
export interface Requirement {
  id: string;
  title: string;
  statement: string;
  type: string;
  priority: string;
  status: Status;
  verification: string[];
  evidence?: string[];
  note?: string;
}
export interface TestTitle {
  file: string;
  title: string;
  ids: string[];
}
export interface TraceResult {
  areas: Record<string, string>;
  requirements: Requirement[];
  tests: TestTitle[];
  coverage: Map<string, string[]>;
  problems: string[];
  markdown: string;
}

const ID = /REQ-[A-Z]+-\d{3}/g;
const ALLOWED_VERIFICATION = new Set(["test", "inspection", "analysis", "demonstration"]);
const ALLOWED_STATUS = new Set(["implemented", "partial", "planned"]);

function walk(dir: string, visit: (file: string) => void) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "build" || entry === ".next" || entry === ".gradle" || entry.startsWith(".git")) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, visit);
    else visit(path);
  }
}

/** Titles of tests, from TypeScript (node:test) and Kotlin (JUnit, backtick names) sources. */
export function scanTests(root: string): TestTitle[] {
  const out: TestTitle[] = [];
  const tsTest = /\b(?:test|it)(?:\.\w+)?\(\s*(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
  const ktTest = /fun\s+`([^`]+)`\s*\(/g;
  const add = (file: string, title: string) => out.push({ file: relative(root, file), title, ids: [...new Set(title.match(ID) ?? [])] });
  walk(join(root, "tests"), (file) => {
    if (!file.endsWith(".test.ts")) return;
    for (const match of readFileSync(file, "utf8").matchAll(tsTest)) add(file, match[2]);
  });
  walk(join(root, "android"), (file) => {
    if (!file.endsWith(".kt") || !/\/src\/(test|androidTest)\//.test(file)) return;
    for (const match of readFileSync(file, "utf8").matchAll(ktTest)) add(file, match[1]);
  });
  return out;
}

export function analyse(root: string): TraceResult {
  const registryPath = join(root, "docs", "requirements", "requirements.yaml");
  const registry = YAML.parse(readFileSync(registryPath, "utf8")) as { areas: Record<string, string>; requirements: Requirement[] };
  const problems: string[] = [];
  const areas = registry.areas ?? {};
  const requirements = registry.requirements ?? [];
  const tests = scanTests(root);

  const seen = new Set<string>();
  for (const requirement of requirements) {
    const where = requirement.id ?? "(missing id)";
    const match = /^REQ-([A-Z]+)-(\d{3})$/.exec(requirement.id ?? "");
    if (!match) problems.push(`${where}: id must look like REQ-AREA-001`);
    else if (!(match[1] in areas)) problems.push(`${where}: area ${match[1]} is not declared under "areas"`);
    if (seen.has(requirement.id)) problems.push(`${where}: duplicate id`);
    seen.add(requirement.id);
    for (const field of ["title", "statement", "type", "priority", "status"] as const) {
      if (!requirement[field] || String(requirement[field]).trim().length < 3) problems.push(`${where}: missing ${field}`);
    }
    if (requirement.statement && requirement.statement.length < 30) problems.push(`${where}: the statement is too short to be verifiable`);
    if (!ALLOWED_STATUS.has(requirement.status)) problems.push(`${where}: status must be one of ${[...ALLOWED_STATUS].join(", ")}`);
    if (!Array.isArray(requirement.verification) || requirement.verification.length === 0) problems.push(`${where}: verification is required`);
    for (const method of requirement.verification ?? []) if (!ALLOWED_VERIFICATION.has(method)) problems.push(`${where}: unknown verification method "${method}"`);
  }

  const coverage = new Map<string, string[]>();
  for (const requirement of requirements) coverage.set(requirement.id, []);
  for (const test of tests) {
    for (const id of test.ids) {
      if (!coverage.has(id)) problems.push(`${test.file}: test "${test.title.slice(0, 70)}" cites unknown requirement ${id}`);
      else coverage.get(id)?.push(test.file);
    }
  }

  for (const requirement of requirements) {
    const files = coverage.get(requirement.id) ?? [];
    const methods = requirement.verification ?? [];
    if (requirement.status === "planned") {
      if (!requirement.note) problems.push(`${requirement.id}: a planned requirement needs a note saying when and why`);
      continue;
    }
    if (methods.includes("test") && files.length === 0) problems.push(`${requirement.id}: ${requirement.status} but no test cites it`);
    if (methods.some((method) => method !== "test")) {
      const evidence = requirement.evidence ?? [];
      if (evidence.length === 0) problems.push(`${requirement.id}: ${methods.filter((m) => m !== "test").join("/")} verification needs evidence files`);
      for (const path of evidence) if (!existsSync(join(root, path))) problems.push(`${requirement.id}: evidence file ${path} does not exist`);
    }
  }

  return { areas, requirements, tests, coverage, problems, markdown: render(areas, requirements, coverage) };
}

function render(areas: Record<string, string>, requirements: Requirement[], coverage: Map<string, string[]>): string {
  const lines: string[] = [
    "# Requirements traceability",
    "",
    "_Generated by `npm run trace` from `docs/requirements/requirements.yaml` and the test titles in `tests/` and `android/`. Do not edit by hand; CI fails if it is out of date._",
    "",
    "Each requirement is verified by automated tests (cited by id in the test title), by inspected evidence, or both. `npm run trace:check` fails when an implemented requirement has neither.",
    "",
    "## Summary",
    "",
    "| Area | Requirements | Implemented | Partial | Planned | Verified by tests |",
    "| --- | ---: | ---: | ---: | ---: | ---: |",
  ];
  const total = { all: 0, implemented: 0, partial: 0, planned: 0, tested: 0 };
  for (const [area, name] of Object.entries(areas)) {
    const own = requirements.filter((requirement) => requirement.id.startsWith(`REQ-${area}-`));
    const count = (status: Status) => own.filter((requirement) => requirement.status === status).length;
    const tested = own.filter((requirement) => (coverage.get(requirement.id)?.length ?? 0) > 0).length;
    lines.push(`| ${area} - ${name} | ${own.length} | ${count("implemented")} | ${count("partial")} | ${count("planned")} | ${tested} |`);
    total.all += own.length;
    total.implemented += count("implemented");
    total.partial += count("partial");
    total.planned += count("planned");
    total.tested += tested;
  }
  lines.push(`| **Total** | **${total.all}** | **${total.implemented}** | **${total.partial}** | **${total.planned}** | **${total.tested}** |`, "");

  for (const [area, name] of Object.entries(areas)) {
    const own = requirements.filter((requirement) => requirement.id.startsWith(`REQ-${area}-`));
    if (own.length === 0) continue;
    lines.push(`## ${area} - ${name}`, "", "| Id | Requirement | Type | Status | Tests | Test files | Evidence |", "| --- | --- | --- | --- | ---: | --- | --- |");
    for (const requirement of own) {
      const files = [...new Set(coverage.get(requirement.id) ?? [])].sort();
      const shown = files.slice(0, 3).map((file) => `\`${basename(file)}\``).join(", ") + (files.length > 3 ? ` +${files.length - 3}` : "");
      const evidence = (requirement.evidence ?? []).map((path) => `\`${path}\``).join(", ");
      lines.push(`| ${requirement.id} | **${requirement.title}.** ${requirement.statement} | ${requirement.type} | ${requirement.status} | ${(coverage.get(requirement.id) ?? []).length} | ${shown || "-"} | ${evidence || "-"} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1]?.endsWith("traceability.ts")) {
  const root = process.cwd();
  const result = analyse(root);
  const target = join(root, "docs", "requirements", "traceability.md");
  if (process.argv.includes("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    const stale = current !== result.markdown;
    for (const problem of result.problems) console.error(`  - ${problem}`);
    if (stale) console.error("docs/requirements/traceability.md is out of date: run `npm run trace` and commit it.");
    if (result.problems.length > 0 || stale) process.exit(1);
    console.log(`Traceability OK: ${result.requirements.length} requirements, ${result.tests.length} tests scanned, no gaps.`);
  } else {
    writeFileSync(target, result.markdown);
    console.log(`Wrote ${relative(root, target)} (${result.requirements.length} requirements, ${result.problems.length} problems).`);
    for (const problem of result.problems) console.log(`  - ${problem}`);
  }
}
