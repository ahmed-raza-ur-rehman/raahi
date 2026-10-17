import assert from "node:assert/strict";
import test from "node:test";

import { services } from "@/data/catalog";
import { getResource, resources } from "@/data/opportunities/resources";
import { ECOSYSTEM, appUrl, recommendForTopic, recommendPrep } from "@/lib/opportunities/ecosystem";
import { buildIcs, foldLine } from "@/lib/opportunities/ics";
import { rankMatches, scoreMatch } from "@/lib/opportunities/match";
import { buildApplicationPlan, documentChecklist } from "@/lib/opportunities/plan";
import { analyzeOffer, extractOepLicences } from "@/lib/opportunities/scam";
import { SOURCES } from "@/lib/opportunities/scrapers/sources";
import { RESOURCE_CATEGORIES, type OpportunityView } from "@/lib/opportunities/types";

const NOW = new Date("2026-10-11T06:00:00Z");

// ─── Scam / fraud checker ────────────────────────────────────────────────────

test("flags a classic fake overseas-job message as high risk and explains why", () => {
  const message = "Saudi visa ready! 100% guaranteed job, no interview. Pay processing fee Rs 150000 on JazzCash to my personal account today only, limited seats. Contact on WhatsApp 0300-1234567. Visit visa then convert to work.";
  const result = analyzeOffer({ text: message });
  assert.equal(result.level, "high");
  assert.ok(result.score >= 80);
  const ids = result.signals.map((signal) => signal.id);
  for (const id of ["advance-fee", "guaranteed", "no-requirements", "risky-payment", "urgency", "messaging-only", "visit-visa-work"]) assert.ok(ids.includes(id), id);
  assert.ok(result.signals.every((signal) => signal.en.length > 20 && signal.ur.length > 10), "every signal is explained in English and Urdu");
  assert.ok(result.advice.some((entry) => entry.url === "https://beoe.gov.pk/list-of-oeps?show=active"), "points to the official licence list");
  assert.ok(result.advice.some((entry) => entry.url === "https://beoe.gov.pk/complaints"));
  assert.ok(result.advice.some((entry) => entry.url === "https://www.fia.gov.pk/"));
  assert.match(result.disclaimer.en, /does not accuse/);
});

test("catches the same patterns written in Urdu", () => {
  const result = analyzeOffer({ text: "دبئی کا ویزا یقینی ہے، بغیر انٹرویو۔ ایڈوانس رقم جمع کرائیں، جلدی کریں، محدود نشستیں۔" });
  assert.ok(["medium", "high"].includes(result.level), result.level);
  const ids = result.signals.map((signal) => signal.id);
  assert.ok(ids.includes("advance-fee") && ids.includes("no-requirements") && ids.includes("urgency"));
});

test("does not cry wolf at an ordinary job advertisement or an official scholarship call", () => {
  const job = analyzeOffer({ text: "Job opportunity for Research Assistant at Engineering Development Board. Qualification: master's degree. Apply through the National Job Portal before 21 October 2026." });
  assert.equal(job.level, "none");
  assert.equal(job.signals.length, 0);
  assert.match(job.headline.en, /not proof/i, "even a clean result is never called 'safe'");

  const scholarship = analyzeOffer({ text: "Applications for the Chevening Scholarship are open. Applicants must have two years of work experience and an offer from a UK university. Apply on the official website." });
  assert.equal(scholarship.level, "none");
});

test("never double counts a signal found in the text and ticked in the checklist, and verification lowers the score", () => {
  const text = "Pay the visa processing fee in advance to confirm your seat.";
  const alone = analyzeOffer({ text });
  const withAnswer = analyzeOffer({ text, answers: { askedToPay: true } });
  assert.equal(withAnswer.score, alone.score);

  const risky = analyzeOffer({ text: "Guaranteed visa, pay advance fee", answers: { noLicenceNumber: true, pressureToDecide: true } });
  const verified = analyzeOffer({ text: "Guaranteed visa, pay advance fee", answers: { noLicenceNumber: true, pressureToDecide: true, verifiedOnOfficialSite: true } });
  assert.ok(verified.score < risky.score);

  assert.equal(analyzeOffer({ answers: { askedForOtpOrPassword: true } }).level, "medium");
  assert.equal(analyzeOffer({ text: "x".repeat(20000) }).level, "none", "long input is bounded and safe");
});

test("extracts BE&OE licence numbers in the format the regulator publishes", () => {
  assert.deepEqual(extractOepLicences("Our company OEPL No. 2401/LHR is registered; also 1328/KAR and (0912/RWP)."), [
    { raw: "OEPL No. 2401/LHR", number: "2401", city: "LHR" },
    { raw: "1328/KAR", number: "1328", city: "KAR" },
    { raw: "0912/RWP", number: "0912", city: "RWP" },
  ]);
  assert.deepEqual(extractOepLicences("call 0300-1234567 or visit on 12/10/2026"), [], "phone numbers and dates are not licences");
  const result = analyzeOffer({ text: "Visa for Qatar, OEPL No. 2401/LHR, pay advance fee" });
  assert.equal(result.oepLicences[0].number, "2401");
  assert.ok(result.advice.some((entry) => /2401\/LHR/.test(entry.en)));
});

// ─── Planner, checklist, calendar ────────────────────────────────────────────

test("builds a dated plan counted back from the deadline and compresses steps already overdue", () => {
  const far = buildApplicationPlan({ kind: "scholarship", scope: "international", tags: [], deadline: "2027-01-31" }, NOW);
  assert.equal(far[0].id, "eligibility");
  assert.equal(far[0].due, "2026-11-17", "75 days before 31 Jan 2027");
  assert.equal(far.at(-1)?.due, "2027-01-30");
  assert.ok(far.every((step) => !step.late));
  const dates = far.map((step) => step.due as string);
  assert.deepEqual([...dates].sort(), dates, "chronological");

  const tight = buildApplicationPlan({ kind: "scholarship", scope: "international", tags: [], deadline: "2026-10-25" }, NOW);
  const late = tight.filter((step) => step.late);
  assert.ok(late.length >= 4);
  assert.ok(late.every((step) => step.due === "2026-10-11"), "overdue steps become 'do now'");
  assert.equal(tight.at(-1)?.due, "2026-10-24");

  assert.ok(buildApplicationPlan({ kind: "scholarship", scope: "international", tags: [] }, NOW).every((step) => step.due === undefined), "no deadline → ordered steps without dates");
});

test("chooses the right template for government jobs, overseas jobs, internships and courses", () => {
  const ids = (item: Parameters<typeof buildApplicationPlan>[0]) => buildApplicationPlan(item, NOW).map((step) => step.id);
  assert.ok(ids({ kind: "job", scope: "pakistan", tags: ["government", "njp"], deadline: "2026-10-25" }).includes("read-ad"));
  assert.ok(ids({ kind: "job", scope: "international", tags: ["germany"], deadline: "2026-12-01" }).includes("protector"));
  assert.ok(ids({ kind: "job", scope: "international", tags: ["remote"], deadline: "2026-12-01" }).includes("cv"));
  assert.ok(ids({ kind: "internship", scope: "pakistan", tags: [], deadline: "2026-12-01" }).includes("letter"));
  assert.deepEqual(ids({ kind: "coupon", scope: "international", tags: [] }), ["enrol"]);
  assert.ok(ids({ kind: "competition", scope: "international", tags: [], deadline: "2026-11-01" }).includes("team"));
});

test("document checklists are specific to the kind of opportunity", () => {
  const scholarship = documentChecklist({ kind: "scholarship", scope: "international", tags: [] }).map((item) => item.en).join("|");
  assert.match(scholarship, /HEC-attested/);
  assert.match(scholarship, /recommendation/i);
  const govt = documentChecklist({ kind: "job", scope: "pakistan", tags: [] }).map((item) => item.en).join("|");
  assert.match(govt, /Domicile/);
  const overseas = documentChecklist({ kind: "job", scope: "international", tags: [] }).map((item) => item.en).join("|");
  assert.match(overseas, /e-Protector/);
  assert.ok(documentChecklist({ kind: "course", scope: "international", tags: [] }).every((item) => item.ur.length > 0));
});

test("iCalendar output is valid: CRLF endings, escaped text, all-day dates, folded long lines", () => {
  const ics = buildIcs(
    [{ uid: "abc", summary: "Deadline: Chevening, UK; apply", description: "Line one\nLine two with a very long sentence that goes on and on past the seventy-five octet limit for a single content line", date: "2026-11-14", url: "https://www.chevening.org/" }],
    "My deadlines",
    NOW,
  );
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n"));
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(!/[^\r]\n/.test(ics), "every line ends with CRLF");
  assert.match(ics, /DTSTART;VALUE=DATE:20261114\r\n/);
  assert.match(ics, /DTEND;VALUE=DATE:20261115\r\n/);
  assert.match(ics, /SUMMARY:Deadline: Chevening\\, UK\\; apply\r\n/);
  assert.match(ics, /DTSTAMP:20261011T060000Z/);
  assert.match(ics, /BEGIN:VALARM/);
  for (const line of ics.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, `line too long: ${line.length}`);
  assert.equal(foldLine("short"), "short");
  const folded = foldLine("é".repeat(60)); // multi-byte characters are never split in the middle
  assert.ok(folded.includes("\r\n "));
  assert.equal(folded.replace(/\r\n /g, ""), "é".repeat(60));
  assert.match(buildIcs([{ uid: "y", summary: "x", date: "2026-12-31" }], "c", NOW), /DTEND;VALUE=DATE:20270101/, "rolls over the year");
});

// ─── Profile matcher ─────────────────────────────────────────────────────────

function view(overrides: Partial<OpportunityView> & { id: string; title: string }): OpportunityView {
  return {
    kind: "scholarship", scope: "international", url: `https://x.example/${overrides.id}`, sourceId: "x", sourceName: "X", sourceUrl: "https://x.example/",
    levels: [], fields: [], tags: [], firstSeen: NOW.toISOString(), lastSeen: NOW.toISOString(), dedupeKey: overrides.id,
    status: "open", daysLeft: 30, isNew: false, openToPakistan: true, ...overrides,
  } as OpportunityView;
}

test("matcher scores by level, field, funding and explains each pick; it drops what cannot apply", () => {
  const items = [
    view({ id: "a", title: "Fully funded MSc in Computer Science", levels: ["masters"], fields: ["computer-science"], funding: "full", country: "Germany" }),
    view({ id: "b", title: "PhD in Physics", levels: ["phd"], fields: ["natural-sciences"], funding: "full" }),
    view({ id: "c", title: "Scholarships for African students", levels: ["masters"], openToPakistan: false }),
    view({ id: "d", title: "Women in Tech Scholarship", levels: ["masters"], fields: ["computer-science"] }),
    view({ id: "e", title: "Expired programme", levels: ["masters"], fields: ["computer-science"], status: "closed", daysLeft: -3 }),
  ];
  const ranked = rankMatches({ level: "masters", fields: ["computer-science"], needsFunding: true, country: "Germany", interests: ["scholarship"] }, items);
  assert.equal(ranked[0].item.id, "a");
  assert.ok(ranked[0].reasons.length >= 4);
  assert.ok(ranked.every((entry) => !["c", "e"].includes(entry.item.id)), "not open to Pakistan / closed are excluded");
  assert.ok(ranked.find((entry) => entry.item.id === "b") === undefined || (ranked.find((entry) => entry.item.id === "b")?.score ?? 0) < ranked[0].score);

  const female = rankMatches({ level: "masters", fields: ["computer-science"], gender: "female" }, items);
  const male = rankMatches({ level: "masters", fields: ["computer-science"], gender: "male" }, items);
  assert.ok(female.some((entry) => entry.item.id === "d") && (female.find((e) => e.item.id === "d")?.score ?? 0) > (female.find((e) => e.item.id === "a")?.score ?? 99));
  assert.ok(!male.some((entry) => entry.item.id === "d"), "women-only programmes are not shown to men");
  assert.equal(scoreMatch({ interests: ["job"] }, items[0]), undefined, "other kinds are filtered out");
});

test("matcher warns when the deadline is close or Pakistan eligibility is unknown", () => {
  const result = scoreMatch({ keywords: "robotics" }, view({ id: "z", title: "Robotics fellowship", daysLeft: 3, openToPakistan: undefined }));
  assert.ok(result);
  assert.ok(result.warnings.some((warning) => /Closes in 3 days/.test(warning.en)));
  assert.ok(result.warnings.some((warning) => /Pakistan/.test(warning.en)));
});

// ─── Ecosystem (the three sibling apps) ──────────────────────────────────────

test("ecosystem links the user's three apps and recommends them only when relevant", () => {
  assert.deepEqual(ECOSYSTEM.map((app) => app.url), ["https://psc-ajk.vercel.app/", "https://mdcat-prep-beta.vercel.app/", "https://cognitive-fitness-blond.vercel.app/"]);
  const pick = (input: Parameters<typeof recommendPrep>[0]) => recommendPrep(input).map((entry) => entry.app.id);

  assert.deepEqual(pick({ kind: "job", title: "Assistant Director", organization: "Federal Public Service Commission" }), ["neuroprep"]);
  assert.deepEqual(pick({ kind: "job", title: "Lecturer (BPS-18)", tags: ["government"], jobType: "Regular", summary: "NJP" }), ["neuroprep"]);
  assert.deepEqual(pick({ kind: "job", title: "Research Assistant", tags: ["government", "njp"], jobType: "Contract" }), [], "contract posts rarely have MCQ tests");
  assert.deepEqual(pick({ kind: "notice", title: "MDCAT 2026 registration announced" }), ["mdcat-prepmaster"]);
  assert.deepEqual(pick({ kind: "scholarship", title: "Fully funded masters — IELTS required" }), ["cognitive-fitness"]);
  assert.deepEqual(pick({ kind: "coupon", title: "Python for beginners" }), ["cognitive-fitness"]);
  assert.deepEqual(pick({ kind: "competition", title: "AI hackathon" }), []);
  assert.deepEqual(recommendForTopic("CSS exam preparation").map((entry) => entry.app.id), ["neuroprep"]);
  assert.ok(recommendPrep({ kind: "course", title: "x" })[0].reason.ur.length > 5);

  const cf = ECOSYSTEM.find((app) => app.id === "cognitive-fitness");
  assert.match(cf?.boundary?.en ?? "", /not medical advice/i, "keeps the app's own honest boundary visible");
  assert.equal(appUrl(cf!, "journeys"), "https://cognitive-fitness-blond.vercel.app/journeys?utm_source=raahi&utm_medium=opportunities");
  assert.equal(appUrl(ECOSYSTEM[0], "", "chat"), "https://psc-ajk.vercel.app/?utm_source=raahi&utm_medium=chat");
});

// ─── Directory integrity ─────────────────────────────────────────────────────

test("directory: unique ids and URLs, valid categories, https, real catalog cross-links", () => {
  assert.ok(resources.length >= 130, `expected a broad directory, got ${resources.length}`);
  assert.equal(new Set(resources.map((r) => r.id)).size, resources.length, "ids are unique");
  assert.equal(new Set(resources.map((r) => r.url.replace(/\/$/, ""))).size, resources.length, "no URL is listed twice");

  const categories = new Set<string>(RESOURCE_CATEGORIES);
  const catalogIds = new Set(services.map((service) => service.id));
  const insecure: string[] = [];
  for (const resource of resources) {
    assert.ok(categories.has(resource.category), `${resource.id}: category`);
    assert.ok(resource.name.length > 2 && resource.description.length > 20 && resource.description.length <= 260, `${resource.id}: description length`);
    assert.ok(resource.tags.length >= 1, `${resource.id}: tags`);
    assert.doesNotThrow(() => new URL(resource.url), `${resource.id}: url`);
    if (!resource.url.startsWith("https://")) insecure.push(resource.id);
    if (resource.checked) assert.match(resource.checked, /^\d{4}-\d{2}-\d{2}$/);
    for (const serviceId of resource.relatedServiceIds ?? []) assert.ok(catalogIds.has(serviceId), `${resource.id}: unknown catalog service ${serviceId}`);
  }
  assert.deepEqual(insecure, ["hec-scholarship-portal"], "only HEC's own portal is published over http");
  for (const category of RESOURCE_CATEGORIES) assert.ok(resources.some((r) => r.category === category), `category ${category} has entries`);
});

test("directory: every user-requested resource is present, and sources and resources point at each other", () => {
  for (const id of ["scholarshiptab", "njp", "nastp", "oec", "oec-jobs", "beoe", "digiskills", "navttc", "pseb", "edx", "harvard-cs50", "techtanic-duce", "real-discount", "neuroprep", "mdcat-prepmaster", "cognitive-fitness", "ajkpsc", "hec-scholarship-portal"]) {
    assert.ok(getResource(id), `missing ${id}`);
  }
  for (const source of SOURCES) {
    assert.ok(source.resourceId && getResource(source.resourceId), `source ${source.id} points at a missing resource`);
    assert.equal(getResource(source.resourceId as string)?.sourceId, source.id, `resource ${source.resourceId} should name source ${source.id}`);
  }
  for (const resource of resources.filter((r) => r.sourceId)) assert.ok(SOURCES.some((s) => s.id === resource.sourceId), `${resource.id}: unknown source`);

  // Provenance is honest: only URLs actually opened this session carry a checked date.
  const checked = resources.filter((r) => r.checked);
  assert.ok(checked.length >= 25 && checked.length < resources.length);
  assert.ok(checked.every((r) => r.checked === "2026-10-11"));

  // Pakistan-focused official entries are available in Urdu.
  for (const id of ["njp", "beoe", "beoe-oep-list", "oec", "digiskills", "navttc", "pseb", "fpsc", "ppsc", "ajkpsc", "hec"]) {
    assert.ok(getResource(id)?.nameUr, `${id} needs an Urdu name`);
  }
  // The directory never presents the Udemy auto-enroller as something RAAHI does.
  assert.match(getResource("techtanic-duce")?.note ?? "", /never logs in to Udemy/);
});
