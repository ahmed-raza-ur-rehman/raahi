import assert from "node:assert/strict";
import test from "node:test";

import {
  computeStatus,
  daysUntil,
  extractDeadline,
  parseDateRange,
  parseLooseDate,
  toIsoDateTime,
  todayInPakistan,
} from "@/lib/opportunities/dates";
import { dedupeOpportunities } from "@/lib/opportunities/dedupe";
import {
  countryFromWord,
  inferCountry,
  inferEligibility,
  inferFields,
  inferFunding,
  inferKind,
  inferLevels,
  inferRemoteEligibility,
} from "@/lib/opportunities/infer";
import { normalizeAll, normalizeOpportunity, type SourceMeta } from "@/lib/opportunities/normalize";
import { canonicalUrl, dedupeKeyFor, jaccard, stableHash, stripHtml, titleTokens, truncate } from "@/lib/opportunities/text";
import type { Opportunity } from "@/lib/opportunities/types";

const NOW = new Date("2026-10-11T06:00:00Z");
const SOURCE: SourceMeta = { id: "demo", name: "Demo", homepage: "https://demo.example/", defaultKind: "scholarship", scope: "international" };

test("parses the deadline formats seen on real listing sites", () => {
  assert.equal(parseLooseDate("Deadline: November 14, 2026"), "2026-11-14");
  assert.equal(parseLooseDate("Deadline is 15 December 2026. Course starts September 2027"), "2026-12-15");
  assert.equal(parseLooseDate("Available Till Oct 25, 2026"), "2026-10-25");
  assert.equal(parseLooseDate("closes on 1st November 2026"), "2026-11-01");
  assert.equal(parseLooseDate("2026-01-31"), "2026-01-31");
  assert.equal(parseLooseDate("14/11/2026"), "2026-11-14", "day-first for South Asian dates");
  assert.equal(parseLooseDate("11/25/2026"), "2026-11-25", "falls back to month-first when day > 12");
  assert.equal(parseLooseDate("31 February 2026"), undefined, "rejects impossible dates");
  assert.equal(parseLooseDate("Not Specified"), undefined);
});

test("extracts a deadline only when a deadline keyword precedes the date", () => {
  assert.equal(extractDeadline("Deadline: November 1, 2026 Applications for the WomanKind Creative Grant 2027 are now open.").date, "2026-11-01");
  assert.equal(extractDeadline("Last date to apply: 22 June 2026").date, "2026-06-22");
  assert.equal(extractDeadline("Posted on 3 October 2026 by admin").date, undefined, "a posting date is not a deadline");
  assert.equal(extractDeadline("Deadline: Not Specified").date, undefined);
  assert.equal(extractDeadline("Applications are reviewed on a rolling basis").rolling, true);
});

test("parses Devpost style submission ranges", () => {
  assert.deepEqual(parseDateRange("Aug 31 - Oct 23, 2026"), { start: "2026-08-31", end: "2026-10-23" });
  assert.deepEqual(parseDateRange("Oct 05 - 27, 2026"), { start: "2026-10-05", end: "2026-10-27" });
  assert.deepEqual(parseDateRange("Dec 15, 2026 - Jan 20, 2027"), { start: "2026-12-15", end: "2027-01-20" });
  assert.deepEqual(parseDateRange("Dec 15 - Jan 20, 2027"), { start: "2026-12-15", end: "2027-01-20" }, "wraps over New Year");
});

test("normalises timestamps from different APIs to UTC ISO strings", () => {
  assert.equal(toIsoDateTime("2026-10-08T21:47:32"), "2026-10-08T21:47:32.000Z");
  assert.equal(toIsoDateTime("2026-10-11 05:41:04"), "2026-10-11T05:41:04.000Z");
  assert.equal(toIsoDateTime(1791687313), "2026-10-11T02:55:13.000Z");
  assert.equal(toIsoDateTime("Tue, 06 Oct 2026 21:46:57 +0000"), "2026-10-06T21:46:57.000Z");
  assert.equal(toIsoDateTime("garbage"), undefined);
});

test("computes deadline status in Pakistan time", () => {
  assert.equal(todayInPakistan(new Date("2026-10-11T20:30:00Z")), "2026-10-12", "20:30 UTC is already tomorrow in PKT");
  assert.equal(daysUntil("2026-10-25", NOW), 14);
  assert.deepEqual(computeStatus({ deadline: "2026-10-14", kind: "job" }, NOW), { status: "closing-soon", daysLeft: 3 });
  assert.deepEqual(computeStatus({ deadline: "2026-10-10", kind: "job" }, NOW), { status: "closed", daysLeft: -1 });
  assert.deepEqual(computeStatus({ deadline: "2026-12-01", kind: "job" }, NOW), { status: "open", daysLeft: 51 });
  assert.equal(computeStatus({ rolling: true, kind: "job" }, NOW).status, "rolling");
  assert.equal(computeStatus({ kind: "job" }, NOW).status, "unknown");
});

test("strips HTML, entities and feed boilerplate", () => {
  const html = "<p>Are you a bright student &amp; looking for a scholarship?&nbsp;You can study in the USA&hellip; <a href=\"/x\">Read more »</a></p>";
  assert.equal(stripHtml(html), "Are you a bright student & looking for a scholarship? You can study in the USA", "trailing ellipsis and Read-more links are removed");
  assert.equal(stripHtml("The post Foo appeared first on Bar Site"), "");
  assert.equal(stripHtml("&#8217;quoted&#x2019;"), "’quoted’");
  assert.equal(truncate("word ".repeat(100).trim(), 40).length <= 40, true);
});

test("canonicalises URLs without losing the Udemy coupon code", () => {
  assert.equal(
    canonicalUrl("https://WWW.Udemy.com/course/python-pcep/?couponCode=GRATIS100OCT2026&utm_source=x#top"),
    "https://www.udemy.com/course/python-pcep/?couponCode=GRATIS100OCT2026",
  );
  assert.equal(canonicalUrl("https://a.example/page/?fbclid=1"), "https://a.example/page");
  assert.equal(canonicalUrl("javascript:alert(1)"), undefined);
  assert.equal(canonicalUrl("/jobs/9818", "https://njp.gov.pk"), "https://njp.gov.pk/jobs/9818");
  assert.equal(stableHash("abc"), stableHash("abc"));
  assert.notEqual(stableHash("abc"), stableHash("abd"));
});

test("infers kind, level, funding, country and field from listing text", () => {
  assert.equal(inferKind("Multimodal AI Hackathon 2026", "", "scholarship"), "competition");
  assert.equal(inferKind("NASTP Summer Internship Program 2026", "", "job"), "internship");
  assert.equal(inferKind("Erasmus Mundus Scholarship 2027", "", "job"), "scholarship");
  assert.equal(inferKind("WomanKind Creative Grant 2027", "", "scholarship"), "grant");
  assert.equal(inferKind("Something unclear", "", "job"), "job");

  assert.deepEqual(inferLevels("Master's and PhD scholarships for undergraduate applicants").sort(), ["masters", "phd", "undergraduate"]);
  assert.equal(inferFunding("This is a fully funded scholarship covering tuition"), "full");
  assert.equal(inferFunding("partial tuition waiver available"), "partial");
  assert.equal(inferFunding("monthly stipend of 1,200 USD"), "stipend");
  assert.equal(inferFunding("an ordinary announcement"), undefined);

  assert.equal(inferCountry("Global Korea Scholarship 2027 for study in Korea"), "South Korea");
  assert.equal(inferCountry("Chevening UK Government scholarships"), "United Kingdom");
  assert.equal(inferCountry("Jobs in Dubai and Abu Dhabi"), "United Arab Emirates");
  assert.equal(inferCountry("Nothing geographic here"), undefined);
  assert.equal(inferCountry("Top 20 scholarships: study in the USA, UK, Canada, Australia, France, Switzerland for free"), undefined, "roundups have no single country");
  assert.equal(inferCountry("Scholarships for Pakistani students to study in Germany"), "Germany", "nationality is not the destination");
  assert.equal(inferCountry("Jobs in Islamabad and Lahore"), "Pakistan");
  assert.equal(countryFromWord("germany"), "Germany");
  assert.equal(countryFromWord("uae"), "United Arab Emirates");

  assert.ok(inferFields("MSc in Computer Science and Data Science").includes("computer-science"));
  assert.ok(inferFields("Public health nursing programme").includes("medicine-health"));
});

test("flags listings that are clearly not open to applicants from Pakistan", () => {
  assert.equal(inferEligibility("Mastercard Foundation Scholars Program for talented young Africans").openToPakistan, false);
  assert.equal(inferEligibility("Open to students from Africa, Asia (including Pakistan) and Latin America").openToPakistan, true);
  assert.equal(inferEligibility("Applicants must be a U.S. citizen or permanent resident").openToPakistan, false);
  assert.equal(inferEligibility("Open to international students from all nationalities").openToPakistan, true);
  assert.equal(inferEligibility("A generic announcement").openToPakistan, null);
});

test("judges whether a remote job accepts candidates in Pakistan", () => {
  assert.equal(inferRemoteEligibility("Worldwide").openToPakistan, true);
  assert.equal(inferRemoteEligibility("Anywhere").openToPakistan, true);
  assert.equal(inferRemoteEligibility("APAC").openToPakistan, true);
  assert.equal(inferRemoteEligibility("USA Only").openToPakistan, false);
  assert.equal(inferRemoteEligibility("Europe").openToPakistan, false);
  assert.equal(inferRemoteEligibility("").openToPakistan, null);
  assert.equal(inferRemoteEligibility("Online").openToPakistan, null, "no region named → unknown, not restricted");
  assert.equal(inferRemoteEligibility("Remote").openToPakistan, null);
});

test("REQ-DAT-001 normalises a raw listing into a validated opportunity", () => {
  const { item, reason } = normalizeOpportunity(
    {
      title: "ENS International Selection Scholarships",
      url: "https://www.scholars4dev.com/10324/ens-international-selection-scholarships/?utm_source=rss",
      summary: "<p>2026 ENS International Selection is open to outstanding international students. Master’s Degree at École Normale Supérieure in Paris, France. Deadline is 15 December 2026. Read more »</p>",
      postedAt: "2026-10-06T20:46:48",
    },
    SOURCE,
    NOW,
  );
  assert.equal(reason, undefined);
  assert.ok(item);
  assert.equal(item.kind, "scholarship");
  assert.equal(item.country, "France");
  assert.equal(item.deadline, "2026-12-15");
  assert.deepEqual(item.levels, ["masters"]);
  assert.equal(item.openToPakistan, true);
  assert.equal(item.url, "https://www.scholars4dev.com/10324/ens-international-selection-scholarships");
  assert.match(item.id, /^demo-[0-9a-f]{10}$/);
  assert.equal(item.firstSeen, NOW.toISOString());
  assert.ok(!item.summary?.includes("<p>"));
});

test("REQ-DAT-001 rejects listings without a usable title or http(s) url, and de-duplicates by url", () => {
  const result = normalizeAll(
    [
      { title: "ok title here", url: "https://x.example/a" },
      { title: "ok title here", url: "https://x.example/a#again" },
      { title: "", url: "https://x.example/b" },
      { title: "bad url title", url: "ftp://x.example/c" },
    ],
    SOURCE,
    NOW,
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.rejected.length, 2);
});

function opp(partial: Partial<Opportunity> & Pick<Opportunity, "title" | "sourceId" | "url">): Opportunity {
  const { item } = normalizeOpportunity(
    { title: partial.title, url: partial.url, kind: partial.kind ?? "scholarship", deadline: partial.deadline, organization: partial.organization, country: partial.country },
    { ...SOURCE, id: partial.sourceId, name: partial.sourceId },
    NOW,
  );
  assert.ok(item);
  return { ...item, ...partial };
}

test("REQ-DAT-002 merges the same scholarship listed on several sites and keeps the most authoritative record", () => {
  const authority = (id: string) => ({ official: 1, tab: 4, desk: 4 })[id as "official" | "tab" | "desk"] ?? 4;
  const items = [
    opp({ title: "Commonwealth Master's Scholarships 2027/2028", sourceId: "tab", url: "https://tab.example/commonwealth", deadline: "2026-10-20" }),
    opp({ title: "Commonwealth Masters Scholarship 2027-2028 (fully funded)", sourceId: "desk", url: "https://desk.example/commonwealth-2027" }),
    opp({ title: "Commonwealth Master's Scholarships", sourceId: "official", url: "https://cscuk.example/masters" }),
    opp({ title: "Gates Cambridge Scholarship 2027", sourceId: "tab", url: "https://tab.example/gates", deadline: "2026-12-03" }),
  ];
  const merged = dedupeOpportunities(items, authority);
  assert.equal(merged.length, 2);
  const commonwealth = merged.find((item) => /commonwealth/i.test(item.title));
  assert.ok(commonwealth);
  assert.equal(commonwealth.sourceId, "official");
  assert.equal(commonwealth.deadline, "2026-10-20", "missing deadline is filled in from the duplicate");
  assert.equal(commonwealth.alsoOn?.length, 2);
});

test("does not merge different employers that advertise the same job title, nor coupons", () => {
  const a = opp({ title: "Software Engineer", sourceId: "njp", url: "https://njp.example/1", kind: "job", organization: "Engineering Development Board" });
  const b = opp({ title: "Software Engineer", sourceId: "njp", url: "https://njp.example/2", kind: "job", organization: "NADRA" });
  assert.equal(dedupeOpportunities([a, b]).length, 2);

  const c1 = opp({ title: "Python PCEP Course", sourceId: "rd", url: "https://udemy.example/a?couponCode=X", kind: "coupon" });
  const c2 = opp({ title: "Python PCEP Course", sourceId: "rd", url: "https://udemy.example/b?couponCode=Y", kind: "coupon" });
  assert.equal(dedupeOpportunities([c1, c2]).length, 2);
});

test("title tokens ignore years and filler words so renamed annual editions match", () => {
  assert.deepEqual(titleTokens("Chevening Scholarships 2027/28 — Apply Now"), ["chevening"]);
  assert.ok(jaccard(titleTokens("Global Korea Scholarship 2027"), titleTokens("Global Korea Scholarship (GKS) 2026-2027")) >= 0.6);
  assert.equal(dedupeKeyFor("Erasmus Mundus Scholarship 2027"), "erasmus mundus");
});
