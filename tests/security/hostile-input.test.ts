import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import { GET as listGET } from "@/app/api/v1/opportunities/route";
import { normalizeOpportunity } from "@/lib/opportunities/normalize";
import { canonicalUrl, cleanTitle, isUnsafeHost, sanitizeText, stripHtml } from "@/lib/opportunities/text";
import { getSqlite } from "@/lib/db/client";
import { bootApi, req } from "../helpers/api-harness";

const bench = bootApi("sec-hostile");
const source = { id: "probe", name: "Probe", homepage: "https://probe.example/", defaultKind: "scholarship", scope: "international" } as const;
const NOW = new Date("2026-10-15T08:00:00Z");
const normalise = (raw: { title: string; url: string; applyUrl?: string }) => normalizeOpportunity(raw, source, NOW);

const BIDI = /[\u202A-\u202E\u2066-\u2069]/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/;

// ─── Untrusted scraper output ─────────────────────────────────────────────────

test("[REQ-SEC-018] listing URLs: only plain public http(s) links survive", () => {
  for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,<script>1</script>", "file:///etc/passwd", "vbscript:x", "ftp://example.org/x", "https://user:pass@evil.example/x", "https://trusted.org@evil.example/", "http://localhost/admin", "http://127.0.0.1:8080/", "http://2130706433/", "http://[::1]/", "http://intranet/x", "http://printer.local/", "https://" + "a".repeat(3000) + ".example/"]) {
    assert.equal(normalise({ title: "Free scholarship for everyone", url }).item, undefined, `${url.slice(0, 50)} must be rejected`);
  }
  assert.equal(normalise({ title: "Valid scholarship title here", url: "https://ok.example/a", applyUrl: "javascript:alert(1)" }).item?.applyUrl, undefined, "a hostile apply link is dropped, not kept");
  assert.equal(normalise({ title: "Valid scholarship title here", url: "https://OK.example/a?utm_source=x#frag" }).item?.url, "https://ok.example/a");
  assert.ok(isUnsafeHost("192.168.1.1") && isUnsafeHost("LOCALHOST") && isUnsafeHost("a.internal") && !isUnsafeHost("hec.gov.pk"));
});

test("[REQ-SEC-018] titles: markup, control characters and bidirectional overrides never reach storage; Urdu is preserved", () => {
  const cases: Array<[string, RegExp]> = [
    ["<img src=x onerror=alert(1)>Free <b>scholarship</b> program", /^Free scholarship program$/],
    ["Scholarship \u202Egnp.exe\u202C for students \u2066x\u2069", /^Scholarship gnp\.exe for students x$/],
    ["Scholar\u0000ship\u0007 2027 fully funded", /^Scholarship 2027 fully funded$/],
    ["Sch\u200Bolar\u2060ship\uFEFF 2027 \u00ADfully funded", /^Scholarship 2027 fully funded$/],
    ["&#x202E;gnp.exe scholarship notice", /^gnp\.exe scholarship notice$/],
    ["اسکالرشپ برائے طلبہ ۲۰۲۷", /^اسکالرشپ برائے طلبہ ۲۰۲۷$/],
  ];
  for (const [input, expected] of cases) {
    const item = normalise({ title: input, url: "https://ok.example/a" }).item;
    assert.ok(item, input);
    assert.match(item.title, expected, JSON.stringify(input));
    assert.ok(!BIDI.test(item.title) && !CONTROL.test(item.title));
  }
});

test("[REQ-SEC-018] zero-width joiners are kept only inside Arabic-script words (Urdu orthography), never as hidden text elsewhere", () => {
  assert.equal(sanitizeText("می\u200Cکنم"), "می\u200Cکنم");
  assert.equal(sanitizeText("ab\u200Ccd"), "abcd");
  assert.equal(sanitizeText("\u200Dبہ"), "بہ");
  assert.equal(sanitizeText("a\u00A0b"), "a b");
});

test("[REQ-SEC-018] property: cleaning is total, idempotent and never leaves tags, controls or bidi overrides", () => {
  const nasty = fc
    .array(fc.oneof(fc.constantFrom("<", ">", "&", "#x202E;", "&#8238;", "<script>", "</script>", "<!--", "-->", "\u202E", "\u2066", "\u200B", "\u200D", "\u0000", "\u0085", "\n", "\t", " ", "ا", "ب"), fc.string({ maxLength: 8 })), { maxLength: 30 })
    .map((parts) => parts.join(""));
  fc.assert(
    fc.property(nasty, (input) => {
      const once = cleanTitle(input);
      assert.equal(cleanTitle(once), once, "idempotent");
      assert.ok(!BIDI.test(once) && !CONTROL.test(once) && !/[\u200B\uFEFF\u2060]/.test(once));
      assert.ok(!/<\s*\/?\s*(script|style|img|iframe)\b/i.test(stripHtml(input)));
      assert.ok(!/\s{2}/.test(once) && once === once.trim());
    }),
    { numRuns: 400 },
  );
});

test("[REQ-SEC-018] property: canonicalUrl only ever returns a credential-free, public-host http(s) URL, and never throws", () => {
  const url = fc.oneof(
    fc.webUrl({ withFragments: true, withQueryParameters: true }),
    fc.string({ maxLength: 60 }),
    fc.tuple(fc.constantFrom("javascript:", "data:", "file://", "http://", "https://", "//", "HTTPS://"), fc.constantFrom("user:pw@", "", "127.0.0.1", "localhost", "[::1]", "a.b", "x@y."), fc.string({ maxLength: 30 })).map((parts) => parts.join("")),
  );
  fc.assert(
    fc.property(url, (raw) => {
      const result = canonicalUrl(raw);
      if (result === undefined) return;
      const parsed = new URL(result);
      assert.ok(parsed.protocol === "http:" || parsed.protocol === "https:");
      assert.ok(!parsed.username && !parsed.password && !isUnsafeHost(parsed.hostname));
      assert.ok(result.length <= 2048);
    }),
    { numRuns: 500 },
  );
});

// ─── Hostile queries against search ───────────────────────────────────────────

const CORPUS = [
  "' OR 1=1 --", "\"; DROP TABLE opportunities; --", "1; DELETE FROM opportunity_search", "' UNION SELECT * FROM sqlite_master --",
  "title:scholarship", "title:\"a\" OR organization:\"b\"", "NEAR(a b, 5)", "a AND OR NOT b", "* * *", "\"unterminated", "((((((", "))))))", "-excluded", "^start", "a*b*c*d*", "\\", "%", "_", "%%%___",
  "'", "''", "\"", "\"\"", "`", "${7*7}", "{{7*7}}", "<script>alert(1)</script>", "../../../etc/passwd", "\u0000", "a\u0000b", "😀😀😀", "ǅ", "İstanbul", "ß", "ﷺ", "اسکالرشپ' OR '1'='1",
  "a ".repeat(90), "word ".repeat(40), "x".repeat(199),
];

test("[REQ-SEC-009] search survives an injection corpus: always 200 or 400, never 500, fast, and the data is untouched", async () => {
  const db = getSqlite();
  const count = () => (db.prepare("SELECT COUNT(*) AS n FROM opportunities").get() as { n: number }).n;
  const ftsCount = () => (db.prepare("SELECT COUNT(*) AS n FROM opportunity_search").get() as { n: number }).n;
  const rows = count();
  const fts = ftsCount();
  const slowest: number[] = [];

  // Already-encoded hostile input: lone surrogates, invalid UTF-8, broken percent escapes.
  const RAW = ["%ED%A0%80", "%FF%FE", "%", "%%", "%zz", "%00", "%E2%80%AE", "%C0%AF"];
  for (const raw of [...CORPUS.map((q) => encodeURIComponent(q)), ...RAW]) {
    const q = raw;
    const started = performance.now();
    const response = await listGET(req(`/api/v1/opportunities?limit=5&q=${raw}`));
    slowest.push(performance.now() - started);
    assert.ok([200, 400].includes(response.status), `q=${JSON.stringify(q).slice(0, 40)} returned ${response.status}: ${await response.clone().text()}`);
    if (response.status === 200) {
      const body = await response.json();
      assert.ok(Array.isArray(body.data) && body.data.length <= 5);
    }
  }
  assert.equal(count(), rows, "no row may be added, changed or removed by a search");
  assert.equal(ftsCount(), fts);
  assert.ok(Math.max(...slowest) < 1500, `a hostile query took ${Math.round(Math.max(...slowest))} ms`);
  assert.ok(!bench.logLines.some((line) => /"level":"error"/.test(line)), "no request may have logged a server error");
});

test("[REQ-SEC-009] filter parameters are parameterised: hostile values select nothing and break nothing", async () => {
  for (const [name, value] of [["country", "' OR 1=1 --"], ["country", "%"], ["country", "_"], ["country", "Germany\" OR \"1"]] as const) {
    const response = await listGET(req(`/api/v1/opportunities?limit=5&${name}=${encodeURIComponent(value)}`));
    assert.equal(response.status, 200, `${name}=${value}`);
    assert.equal((await response.json()).page.total, 0, `${name}=${value} must not match everything`);
  }
});

test("[REQ-SEC-009] property: arbitrary query text never produces a server error", async () => {
  await fc.assert(
    fc.asyncProperty(fc.string({ maxLength: 120 }), async (text) => {
      const response = await listGET(req(`/api/v1/opportunities?limit=3&q=${encodeURIComponent(text)}`));
      assert.ok([200, 400].includes(response.status), `status ${response.status} for ${JSON.stringify(text)}`);
    }),
    { numRuns: 150 },
  );
});
