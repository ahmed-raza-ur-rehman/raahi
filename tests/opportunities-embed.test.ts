import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

const SOURCE = readFileSync(join(process.cwd(), "public", "embed", "raahi-opportunities.js"), "utf8");
const embed = createRequire(import.meta.url)(join(process.cwd(), "public", "embed", "raahi-opportunities.js")) as {
  buildQuery: (attrs: Record<string, string>) => string;
  pickLanguage: (attribute?: string, documentLanguage?: string) => "en" | "ur";
  originOf: (host?: string, scriptSrc?: string) => string;
  apiUrl: (origin: string, query: string, limit: number) => string;
  pageUrl: (origin: string, query: string, referrer?: string) => string;
  itemUrl: (origin: string, id: string, referrer?: string) => string;
  deadlineLabel: (item: Record<string, unknown>, language: "en" | "ur") => { text: string; tone: string };
  kindLabel: (kind: string, language: "en" | "ur") => string;
  clampInt: (value: unknown, min: number, max: number, fallback: number) => number;
  KINDS: Record<string, { en: string; ur: string }>;
  STRINGS: Record<"en" | "ur", Record<string, string>>;
};

test("embed: the script loads in a page-less environment (no DOM) and exposes its pure helpers", () => {
  assert.equal(typeof embed.buildQuery, "function");
  assert.doesNotThrow(() => new Function(SOURCE), "valid JavaScript");
});

test("embed: safety — never builds markup from third-party text and never loads anything else", () => {
  assert.doesNotMatch(SOURCE, /\.innerHTML\s*=|outerHTML\s*=|insertAdjacentHTML|document\.write|\beval\s*\(|new Function\(/, "text is only ever inserted with textContent");
  assert.doesNotMatch(SOURCE, /localStorage|document\.cookie|XMLHttpRequest|navigator\.sendBeacon/, "no cookies, no persistent identifiers, no beacons");
  const code = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // the usage example in the header comment is not code
  assert.doesNotMatch(code, /createElement\(["']script["']\)|\.src\s*=|importScripts|import\(/, "does not inject further scripts");
  const hosts = [...SOURCE.matchAll(/https?:\/\/[a-z0-9.-]+/gi)].map((match) => match[0]);
  assert.ok(hosts.every((host) => /raahi-phi\.vercel\.app|github\.com|www\.w3\.org/.test(host)), `unexpected hosts: ${hosts.join(", ")}`);
});

test("embed: attributes become a safe API query — unknown kinds and scopes are dropped, numbers are clamped", () => {
  assert.equal(embed.buildQuery({}), "pk=1");
  assert.equal(embed.buildQuery({ kind: "job, scholarship", scope: "pakistan", q: "python", sort: "deadline", within: "30" }), "kind=job%2Cscholarship&q=python&scope=pakistan&within=30&sort=deadline&pk=1");
  assert.equal(embed.buildQuery({ kind: "job,<script>,admission" }), "kind=job%2Cadmission&pk=1");
  assert.equal(embed.buildQuery({ scope: "mars", sort: "random", within: "99999" }), "within=365&pk=1");
  assert.equal(embed.buildQuery({ remote: "" }), "remote=1&pk=1");
  assert.equal(embed.buildQuery({ pk: "0" }), "pk=0");
  assert.equal(embed.buildQuery({ q: "x".repeat(500) }).length < 160, true);
  assert.equal(embed.clampInt("abc", 1, 12, 5), 5);
  assert.equal(embed.clampInt("50", 1, 12, 5), 12);
  assert.equal(embed.clampInt("0", 1, 12, 5), 1);
});

test("embed: the API host comes from the attribute or the script's own address, and only http(s) is accepted", () => {
  assert.equal(embed.originOf(undefined, "https://raahi.example/embed/raahi-opportunities.js"), "https://raahi.example");
  assert.equal(embed.originOf("http://localhost:3000/anything", "https://raahi.example/embed/x.js"), "http://localhost:3000");
  assert.equal(embed.originOf("javascript:alert(1)", ""), "https://raahi-phi.vercel.app");
  assert.equal(embed.originOf("not a url", ""), "https://raahi-phi.vercel.app");
  assert.equal(embed.originOf(undefined, ""), "https://raahi-phi.vercel.app");
  assert.equal(embed.apiUrl("https://r.example", "kind=job&pk=1", 5), "https://r.example/api/opportunities?kind=job&pk=1&limit=5");
  assert.equal(embed.pageUrl("https://r.example", "kind=job&pk=1", "neuroprep.app"), "https://r.example/opportunities?kind=job&pk=1&utm_source=neuroprep.app&utm_medium=embed");
  assert.equal(embed.itemUrl("https://r.example", "njp-12/34", "a.b"), "https://r.example/opportunities/njp-12%2F34?utm_source=a.b&utm_medium=embed");
});

test("embed: language and deadline wording, in English and Urdu", () => {
  assert.equal(embed.pickLanguage("ur"), "ur");
  assert.equal(embed.pickLanguage(undefined, "ur-PK"), "ur");
  assert.equal(embed.pickLanguage(undefined, "ps"), "ur", "Pashto readers get Urdu, as in the rest of RAAHI");
  assert.equal(embed.pickLanguage(undefined, "en-GB"), "en");
  assert.equal(embed.pickLanguage(undefined, undefined), "en");

  assert.deepEqual(embed.deadlineLabel({ deadline: "2026-10-12", daysLeft: 1 }, "en"), { text: "Closes in 1 day", tone: "urgent" });
  assert.deepEqual(embed.deadlineLabel({ deadline: "2026-10-18", daysLeft: 7 }, "en"), { text: "Closes in 7 days", tone: "soon" });
  assert.deepEqual(embed.deadlineLabel({ deadline: "2026-11-30", daysLeft: 50 }, "ur"), { text: "بند ہونے میں 50 دن", tone: "ok" });
  assert.equal(embed.deadlineLabel({ deadline: "2026-10-11", daysLeft: 0 }, "en").tone, "urgent");
  assert.equal(embed.deadlineLabel({ deadline: "2026-10-01", daysLeft: -10 }, "en").text, "Closed");
  assert.equal(embed.deadlineLabel({ status: "rolling" }, "en").text, "Rolling applications");
  assert.equal(embed.deadlineLabel({}, "ur").text, "آخری تاریخ درج نہیں");
  assert.equal(embed.kindLabel("admission", "ur"), "داخلہ");
  assert.equal(embed.kindLabel("unknown-kind", "en"), "unknown-kind");
  for (const key of Object.keys(embed.STRINGS.en)) assert.ok(embed.STRINGS.ur[key], `Urdu text for “${key}”`);
});

test("embed: every kind RAAHI can return has a label in both languages", async () => {
  const { OPPORTUNITY_KINDS } = await import("@/lib/opportunities/types");
  for (const kind of OPPORTUNITY_KINDS) {
    assert.ok(embed.KINDS[kind], `widget knows “${kind}”`);
    assert.ok(embed.KINDS[kind].en && embed.KINDS[kind].ur);
  }
});
