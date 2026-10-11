import assert from "node:assert/strict";
import test from "node:test";

import { resources } from "@/data/opportunities/resources";
import { ECOSYSTEM } from "@/lib/opportunities/ecosystem";
import { GUIDE_CATEGORIES, getGuide, listGuides, searchGuides, summarizeGuide, tokenize, type Guide, type LText } from "@/lib/opportunities/guides";

const resourceIds = new Set(resources.map((resource) => resource.id));
const appIds = new Set(ECOSYSTEM.map((app) => app.id));
const guides = listGuides();
const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

const texts = (guide: Guide): LText[] => [
  guide.title,
  guide.summary,
  guide.audience,
  ...(guide.duration ? [guide.duration] : []),
  ...guide.steps.flatMap((step) => [step.title, step.body, ...(step.when ? [step.when] : [])]),
  ...guide.checklist,
  ...guide.pitfalls,
];

test("guides: ids are unique URL slugs and every category is used", () => {
  const ids = guides.map((guide) => guide.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(guides.length >= 12, `${guides.length} guides`);
  for (const category of GUIDE_CATEGORIES) assert.ok(guides.some((guide) => guide.category === category), `category ${category} has a guide`);
});

test("guides: every link points at something that exists", () => {
  for (const guide of guides) {
    const linked = [...guide.resourceIds, ...guide.steps.flatMap((step) => step.resourceIds ?? [])];
    for (const id of linked) assert.ok(resourceIds.has(id), `${guide.id} links to unknown resource “${id}”`);
    for (const id of guide.related ?? []) assert.ok(getGuide(id), `${guide.id} relates to unknown guide “${id}”`);
    for (const id of guide.appIds ?? []) assert.ok(appIds.has(id), `${guide.id} names unknown app “${id}”`);
    for (const step of guide.steps) for (const id of step.resourceIds ?? []) assert.ok(guide.resourceIds.includes(id), `${guide.id}: step link ${id} is also in the reference panel`);
    assert.ok(!(guide.related ?? []).includes(guide.id), `${guide.id} does not relate to itself`);
  }
});

test("guides: complete in English and Urdu, with no placeholders, and Urdu is actually Urdu", () => {
  for (const guide of guides) {
    assert.ok(guide.steps.length >= 4, `${guide.id} has at least four steps`);
    assert.ok(guide.checklist.length >= 3, `${guide.id} has a checklist`);
    assert.ok(guide.pitfalls.length >= 3, `${guide.id} lists the mistakes people make`);
    assert.ok(guide.keywords.length >= 6, `${guide.id} has search keywords`);
    for (const text of texts(guide)) {
      assert.ok(text.en.trim().length > 3, `${guide.id}: empty English text`);
      assert.ok(text.ur.trim().length > 3, `${guide.id}: empty Urdu text for “${text.en.slice(0, 40)}”`);
      assert.ok(ARABIC_SCRIPT.test(text.ur), `${guide.id}: Urdu text for “${text.en.slice(0, 40)}” is not in Urdu script`);
      assert.doesNotMatch(`${text.en} ${text.ur}`, /\b(?:TODO|FIXME|lorem|xxx)\b|\{\{|\}\}|undefined/i, `${guide.id}: placeholder text`);
    }
  }
});

test("guides: provenance — a review date, and official sources named for the facts that can go stale", () => {
  for (const guide of guides) {
    assert.match(guide.reviewed, /^\d{4}-\d{2}-\d{2}$/);
    for (const url of guide.sources ?? []) assert.match(url, /^https:\/\/[^\s]+$/);
  }
  const documents = getGuide("documents-attestation")!;
  assert.ok(documents.sources?.some((url) => url.includes("mofa.gov.pk")), "the apostille procedure cites MOFA");
  assert.match(documents.steps.map((step) => step.body.en).join(" "), /27 July 2026/);
  const abroad = getGuide("work-abroad-safely")!;
  assert.ok(abroad.sources?.every((url) => url.includes("beoe.gov.pk")), "the emigration steps cite BE&OE");
  assert.ok(abroad.resourceIds.includes("beoe-eprotector") && abroad.resourceIds.includes("beoe-oep-list"));
});

test("guides: they never promise or quantify what RAAHI cannot keep correct", () => {
  // No fees, quotas, salaries or ages stated as fact; those belong on the official page.
  const rupees = /\b(?:rs\.?|pkr)\s?\d|\d+\s?(?:rs\b|rupees|%\s*quota)|age (?:limit )?of \d+|\bbetween \d+ and \d+ years/i;
  // Warnings such as “nobody can guarantee a visa” are fine; a guide promising an outcome is not.
  const promises = /\b(?:we|raahi|this guide)\s+(?:guarantee|promise|ensure)\b|\bguaranteed to\b|\b100\s?% (?:safe|genuine|legit)|\bis (?:completely |totally )?safe\b/i;
  for (const guide of guides) {
    for (const text of texts(guide)) {
      assert.doesNotMatch(text.en, rupees, `${guide.id}: states a figure — “${text.en.slice(0, 60)}”`);
      assert.doesNotMatch(text.en, promises, `${guide.id}: promises something — “${text.en.slice(0, 60)}”`);
    }
  }
});

test("guide search: English, Roman Urdu and Urdu questions find the right guide first", () => {
  const first = (q: string) => searchGuides({ q })[0]?.id;
  assert.equal(first("fsc ke baad kya karein"), "after-matric-intermediate");
  assert.equal(first("what to do after intermediate"), "after-matric-intermediate");
  assert.equal(first("میٹرک کے بعد کیا کریں"), "after-matric-intermediate");
  assert.equal(first("how to apply for government job"), "apply-government-job");
  assert.equal(first("sarkari naukri kaise"), "apply-government-job");
  assert.equal(first("سرکاری نوکری کے لیے درخواست"), "apply-government-job");
  assert.equal(first("apostille kaise"), "documents-attestation");
  assert.equal(first("اپوسٹل"), "documents-attestation");
  assert.equal(first("hec degree attestation"), "documents-attestation");
  assert.equal(first("bahar naukri visa agent"), "work-abroad-safely");
  assert.equal(first("verify oep licence"), "work-abroad-safely");
  assert.equal(first("fake job offer on whatsapp"), "spot-fake-offers");
  assert.equal(first("جعلی ویزا فراڈ"), "spot-fake-offers");
  assert.equal(first("ielts preparation"), "english-tests");
  assert.equal(first("css ki tayari"), "css-pms-prep");
  assert.equal(first("mdcat"), "mdcat-roadmap");
  assert.equal(first("scholarship abroad masters"), "study-abroad-roadmap");
  assert.equal(first("freelancing upwork"), "freelancing-start");
  assert.equal(first("internship"), "internship-playbook");
  assert.equal(first("udemy coupon safety"), "learn-free-90-days");
  assert.equal(first("cv sop reference letter"), "cv-cover-sop");
});

test("guide search: stop-words do not match, gibberish matches nothing, categories and limits are honoured", () => {
  assert.deepEqual(tokenize("How to apply kaise karein"), ["apply"]);
  assert.deepEqual(searchGuides({ q: "xqzvbn plmokn" }), []);
  assert.equal(searchGuides({}).length, guides.length, "no query lists everything, in curated order");
  assert.equal(searchGuides({})[0].id, "after-matric-intermediate");
  assert.ok(searchGuides({ category: "safety" }).every((guide) => guide.category === "safety"));
  assert.equal(searchGuides({ q: "job", limit: 2 }).length, 2);
  assert.ok(searchGuides({ q: "visa" }).some((guide) => guide.id === "work-abroad-safely"));
});

test("guides: compact summaries are language-aware and link to the guide page", () => {
  const guide = getGuide("spot-fake-offers")!;
  const english = summarizeGuide(guide, "en");
  const urdu = summarizeGuide(guide, "ur");
  assert.equal(english.url, "/opportunities/guides/spot-fake-offers");
  assert.equal(english.title, guide.title.en);
  assert.equal(urdu.title, guide.title.ur);
  assert.equal(summarizeGuide(guide, "ps").title, guide.title.ur, "Pashto falls back to Urdu");
  assert.equal(english.steps, guide.steps.length);
});
