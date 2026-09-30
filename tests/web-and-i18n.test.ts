import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.web.test.db");

import { seedDatabase } from "@/lib/db/seed";
import {
  OFFICIAL_DOMAINS,
  buildDork,
  buildOfficialQuery,
  isOfficialDomain,
  officialSourcesFor,
  publisherName,
} from "@/lib/web/dorking";
import { backoffHost, checkRateLimit, hostOf, hostStatus } from "@/lib/web/scraper";

/**
 * `spendToken` is module-private and is called by `fetchPage` after a successful
 * `checkRateLimit`. To exercise the limiter the way production does, we spend
 * through the same SQL the real path uses.
 */
function spendTokenForTest(host: string) {
  checkRateLimit(host);
  // Force the next refill to see one fewer token by advancing time is not
  // possible here, so emulate the spend directly against the host state.
  const { getSqlite } = require("@/lib/db/client") as typeof import("@/lib/db/client");
  const row = getSqlite()
    .prepare("SELECT tokens FROM web_host_state WHERE host = ?")
    .get(host) as { tokens: string } | undefined;
  if (row) {
    const next = Math.max(0, Number(row.tokens) - 1);
    getSqlite()
      .prepare("UPDATE web_host_state SET tokens = ?, last_at = ? WHERE host = ?")
      .run(String(next), Date.now(), host);
  }
}
import { liveSearchStatus } from "@/lib/web/search";
import { detectLanguage, detectScript } from "@/lib/ai/language";
import { detectIntent, INTENT_TO_MODULE, SPEECH_TAGS } from "@/lib/ai/voice";
import { daysUntil, deadlineLabel, formatDate, formatMoney, isRtl, pick, t } from "@/lib/i18n";
import type { Language, Localized } from "@/lib/types";

seedDatabase();

/* ─────────────────── Official-source dorking ─────────────────── */

test("official domains are recognised, look-alikes are not", () => {
  for (const domain of Object.keys(OFFICIAL_DOMAINS)) {
    assert.equal(isOfficialDomain(domain), true, `${domain} should count as official`);
  }

  // Look-alikes must never be treated as official.
  assert.equal(isOfficialDomain("nadra.com.pk.evil.com"), false);
  assert.equal(isOfficialDomain("notnadra.gov.pk"), false);
  assert.equal(isOfficialDomain("bisp-help.blogspot.com"), false);
});

test("a known publisher resolves to a readable name", () => {
  const domain = Object.keys(OFFICIAL_DOMAINS)[0];
  const name = publisherName(domain);
  assert.ok(name && name.length > 0, "official domains should have a publisher name");
});

test("dork queries stay inside official domains", () => {
  const sites = Object.keys(OFFICIAL_DOMAINS).slice(0, 2);

  const dork = buildDork({ exactPhrases: ["Ehsaas scholarship"], sites });
  assert.ok(dork.includes("site:"), "a dork must constrain the site");
  assert.ok(dork.includes("Ehsaas scholarship"), "the phrase must be preserved");
  for (const site of sites) assert.ok(dork.includes(site), `${site} must be in the dork`);

  // Excluded domains and file types must survive too.
  const constrained = buildDork({
    terms: ["scholarship"],
    sites,
    excludeSites: ["example.com"],
    fileTypes: ["pdf"],
  });
  assert.ok(constrained.includes("-site:example.com"));
  assert.ok(constrained.includes("filetype:pdf"));

  // buildOfficialQuery returns a ready-to-run query for a given template.
  const official = buildOfficialQuery("dates", "scholarship deadline", sites);
  assert.ok(official.includes("scholarship deadline"), "the topic must be preserved");
  for (const site of sites) assert.ok(official.includes(`site:${site}`), `${site} must be constrained`);

  // Every template must produce something usable.
  for (const template of ["notification", "advertisement", "result", "dates", "fee", "application_form"] as const) {
    const query = buildOfficialQuery(template, "scholarship", sites);
    assert.ok(query.length > 0, `${template} must build a query`);
  }
});

test("a topic suggests the official sources that publish it", () => {
  const sources = officialSourcesFor("scholarship");
  assert.ok(sources.length > 0, "a scholarship query should point at official publishers");
  for (const source of sources) {
    assert.match(source.domain, /^[\w.-]+$/, `${source.domain} must be a bare host`);
    assert.ok(source.query.length > 0);
  }
});

/* ─────────────────── Politeness: never overload a host ─────────────────── */

test("hosts are normalised before rate limiting", () => {
  // www. is stripped so `www.nadra.gov.pk` and `nadra.gov.pk` share one bucket.
  assert.equal(hostOf("https://www.nadra.gov.pk/page?a=1"), "nadra.gov.pk");
  assert.equal(hostOf("http://nadra.gov.pk"), "nadra.gov.pk");
  assert.equal(hostOf("https://nadra.gov.pk/x"), hostOf("https://www.nadra.gov.pk/y"));
  assert.equal(hostOf("not a url"), "unknown", "a bad URL must not throw");
});

test("the rate limiter throttles a host instead of hammering it", () => {
  // Use a host nothing else touches, so the bucket starts full.
  const host = `throttle-test-${Date.now()}.example.test`;

  let allowed = 0;
  let denied = 0;
  let waitMs = 0;

  // Mirrors how fetchPage uses the limiter: check first, spend only if allowed.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const decision = checkRateLimit(host);
    if (decision.allowed) {
      allowed += 1;
      spendTokenForTest(host);
    } else {
      denied += 1;
      waitMs = decision.waitMs;
    }
  }

  assert.ok(allowed > 0, "the first requests must be allowed");
  assert.ok(denied > 0, "a burst must eventually be refused, or we would hammer the host");
  assert.ok(waitMs > 0, "a refusal must say how long to wait");
  // The burst capacity is small, so a tight loop must be stopped quickly.
  assert.ok(allowed <= 5, `expected a small burst, allowed ${allowed}`);
});

test("a backed-off host is refused until its penalty expires", () => {
  const host = `backoff-test-${Date.now()}.example.test`;
  const before = hostStatus(host);

  backoffHost(host, 60);
  const after = hostStatus(host);

  assert.notDeepEqual(after, before, "backoff must be recorded against the host");

  const decision = checkRateLimit(host);
  assert.equal(decision.allowed, false, "a penalised host must not be contacted");
});

test("live search reports its status without needing a key", () => {
  const status = liveSearchStatus();
  assert.ok(status, "status must be reported");
  assert.equal(typeof status, "object");
});

/* ─────────────────── Language handling ─────────────────── */

test("script detection tells Arabic script from Latin", () => {
  assert.equal(detectScript("یہ ایک ٹیسٹ ہے"), "arabic");
  assert.equal(detectScript("hello world"), "latin");
});

test("a written query is attributed to the right language", () => {
  assert.equal(detectLanguage("دستاویزات"), "ur", "Arabic script defaults to Urdu");
  assert.equal(detectLanguage("hello there"), "en");
  // An explicit choice from the user must always win.
  assert.equal(detectLanguage("hello there", "ur"), "ur");
});

test("voice intents map to a module", () => {
  for (const intent of Object.keys(INTENT_TO_MODULE) as (keyof typeof INTENT_TO_MODULE)[]) {
    const target = INTENT_TO_MODULE[intent];
    assert.ok(target.route.startsWith("/"), `${intent} must route to a page`);
  }
  // A clear blood request should not be mistaken for something else.
  const intent = detectIntent("I need blood for my father", "en");
  assert.ok(intent in INTENT_TO_MODULE, `unexpected intent: ${intent}`);
});

test("every language has a speech tag for STT and TTS", () => {
  const languages: Language[] = ["en", "ur", "ps", "hkp"];
  for (const language of languages) {
    const tag = SPEECH_TAGS[language];
    assert.ok(tag, `${language} must have speech tags`);
    assert.ok(tag.speech, `${language} needs a recognition tag`);
    assert.ok(tag.tts, `${language} needs a synthesis tag`);
  }
});

/* ─────────────────── i18n fallbacks ─────────────────── */

test("localized values fall back instead of going blank", () => {
  const value: Localized = { en: "Scholarship", ur: "وظیفہ" };

  assert.equal(pick(value, "en"), "Scholarship");
  assert.equal(pick(value, "ur"), "وظیفہ");
  // Pashto is missing, so it must degrade to something readable, never "".
  assert.ok(pick(value, "ps").length > 0);
  // Hindko has no translations yet: it must fall back, never show a blank.
  assert.ok(pick(value, "hkp").length > 0);

  assert.equal(pick(undefined), "");
});

test("right-to-left is correct for every language", () => {
  assert.equal(isRtl("ur"), true);
  assert.equal(isRtl("ps"), true);
  assert.equal(isRtl("hkp"), true);
  assert.equal(isRtl("en"), false);
});

test("the UI dictionary resolves in every supported language", () => {
  const languages: Language[] = ["en", "ur", "ps", "hkp"];
  for (const language of languages) {
    const label = t("myApplications", language);
    assert.ok(label.length > 0, `myApplications must render in ${language}`);
  }
});

test("money, dates and deadlines are formatted", () => {
  assert.ok(formatMoney(0, "PKR", "en").length > 0);
  assert.ok(formatMoney(null, "PKR", "en").length > 0, "unknown money must still read sensibly");

  assert.ok(formatDate("2026-12-01", "en").includes("2026"));
  // An absent date must degrade quietly rather than print "Invalid Date".
  assert.equal(formatDate(undefined, "en"), "");
  assert.equal(formatDate("not-a-date", "en"), "not-a-date");

  assert.ok(typeof daysUntil("2026-12-01") === "number" || daysUntil("2026-12-01") === undefined);
  assert.ok(deadlineLabel({ kind: "rolling", note: { en: "All year", ur: "سال بھر" } }, "en").length > 0);
});
