import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOpportunity } from "@/lib/opportunities/normalize";
import { filterFeedItems, rssAdapter, wordpressAdapter } from "@/lib/opportunities/scrapers/adapters/feeds";
import { HttpError, type HttpClient } from "@/lib/opportunities/scrapers/http";
import { getSource } from "@/lib/opportunities/scrapers/sources";
import type { SourceDefinition } from "@/lib/opportunities/scrapers/types";
import type { RawOpportunity } from "@/lib/opportunities/types";

/**
 * Full-post enrichment, found necessary by running the real scrapers on GitHub's runners on 2026-10-15:
 *  - the excerpt of a WordPress post rarely carries the deadline, the post does;
 *  - some sites answer 403 to a request for `content`, which must not take the whole source down;
 *  - a date read out of free text has to be a plausible closing date;
 *  - aggregators mix openings with how-to articles, which must not be listed as jobs.
 */

const NOW = new Date("2026-10-15T05:00:00Z");
const META = { id: "test", name: "Test", homepage: "https://example.pk/", defaultKind: "job" as const, scope: "pakistan" as const };

function source(overrides: Partial<SourceDefinition> = {}): SourceDefinition {
  return {
    id: "test",
    name: "Test",
    homepage: "https://example.pk/",
    adapter: "wordpress",
    endpoint: "https://example.pk",
    defaultKind: "job",
    scope: "pakistan",
    authority: 4,
    minIntervalMinutes: 60,
    enabled: true,
    attribution: "Test",
    ...overrides,
  };
}

function stub(handler: (url: string) => string | Error): { http: HttpClient; calls: string[] } {
  const calls: string[] = [];
  const respond = (url: string): string => {
    calls.push(url);
    const result = handler(url);
    if (result instanceof Error) throw result;
    return result;
  };
  return {
    calls,
    http: {
      getText: async (url) => ({ status: 200, url, text: respond(url), contentType: "text/plain" }),
      getJson: async <T>(url: string) => JSON.parse(respond(url)) as T,
    },
  };
}

const post = (extra: Record<string, unknown> = {}) => ({
  id: 1,
  date_gmt: "2026-10-10T08:00:00",
  link: "https://example.pk/aiou-jobs-2026/",
  title: { rendered: "AIOU Jobs 2026 – Latest Vacancies" },
  excerpt: { rendered: "<p>Allama Iqbal Open University has announced new posts.</p>" },
  categories: [],
  ...extra,
});

const FULL_TEXT = "<p>Allama Iqbal Open University has announced new posts. Eligibility: master's degree. Last date to apply: 25 October 2026. Send your CV to the registrar. Footer: ZZ-SENTINEL-ZZ.</p>";
const log = () => undefined;

test("WordPress: the full post is requested first and its deadline is used", async () => {
  const { http, calls } = stub(() => JSON.stringify([post({ content: { rendered: FULL_TEXT } })]));
  const raws = await wordpressAdapter({ source: source(), http, now: NOW, log });
  assert.ok(calls[0].includes("_fields=") && calls[0].includes(",content"), "asks for content first");
  assert.equal(raws.length, 1);
  assert.match(raws[0].body ?? "", /Last date to apply: 25 October 2026/);

  const { item } = normalizeOpportunity(raws[0], META, NOW);
  assert.equal(item?.deadline, "2026-10-25");
  // the full text is a helper for inference only: it is never stored
  assert.ok(!JSON.stringify(item).includes("ZZ-SENTINEL-ZZ"));
});

test("WordPress: a 403 for the full text falls back to excerpts, not to an error", async () => {
  const { http, calls } = stub((url) => (url.includes(",content") ? new HttpError(403, url) : JSON.stringify([post()])));
  const raws = await wordpressAdapter({ source: source(), http, now: NOW, log });
  assert.equal(raws.length, 1);
  assert.equal(calls.filter((url) => url.includes("/wp-json/wp/v2/posts")).length, 2);
  assert.ok(!calls.at(-1)!.includes(",content"), "the retry asks for excerpts only");
  assert.equal(raws[0].body, undefined);
});

test("WordPress: sources known to refuse full text never send that request", async () => {
  const { http, calls } = stub(() => JSON.stringify([post()]));
  await wordpressAdapter({ source: source({ params: { deep: false } }), http, now: NOW, log });
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].includes("content"));
  for (const id of ["ntslogin", "schoolsti"]) {
    assert.equal(getSource(id)?.params?.deep, false, `${id} answered 403 to a request for content`);
  }
});

test("WordPress: when the REST API is closed the RSS feed (with its full text) is used", async () => {
  const feed = `<?xml version="1.0"?><rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
    <item><title>NUTECH Jobs 2026 for Lecturers</title><link>https://example.pk/nutech/</link><pubDate>Tue, 13 Oct 2026 08:00:00 +0000</pubDate>
    <description>New posts at NUTECH.</description><content:encoded><![CDATA[<p>New posts at NUTECH. Apply by 30 October 2026 online.</p>]]></content:encoded></item></channel></rss>`;
  const { http } = stub((url) => (url.includes("/wp-json/") ? new HttpError(404, url) : feed));
  const raws = await wordpressAdapter({ source: source(), http, now: NOW, log });
  assert.equal(raws.length, 1);
  assert.match(raws[0].body ?? "", /Apply by 30 October 2026/);
  assert.equal(normalizeOpportunity(raws[0], META, NOW).item?.deadline, "2026-10-30");

  const viaRss = await rssAdapter({ source: source({ adapter: "rss", endpoint: "https://example.pk/feed/" }), http: stub(() => feed).http, now: NOW, log });
  assert.equal(viaRss.length, 1);
});

test("a deadline read from free text must be plausible for that kind of listing", () => {
  const job = (body: string): RawOpportunity => ({ title: "Excise Department Jobs 2026", url: "https://example.pk/excise", summary: "Vacancies announced.", body, postedAt: "2026-10-08T09:00:00Z" });

  // eight months after a job ad was posted is an age cut-off or a typo, not a closing date
  assert.equal(normalizeOpportunity(job("Age is calculated as on 23 June 2027. Last date: 23 June 2027."), META, NOW).item?.deadline, undefined);
  assert.equal(normalizeOpportunity(job("Last date to apply: 31 October 2026."), META, NOW).item?.deadline, "2026-10-31");

  // a scholarship announced a year ahead is normal
  const scholarship: RawOpportunity = { title: "Fully funded scholarship 2028", url: "https://example.org/s", kind: "scholarship", summary: "Master's study abroad.", body: "Deadline: 15 November 2027.", postedAt: "2026-10-08T09:00:00Z" };
  assert.equal(normalizeOpportunity(scholarship, { ...META, scope: "international" }, NOW).item?.deadline, "2027-11-15");
  assert.equal(normalizeOpportunity({ ...scholarship, body: "Deadline: 15 November 2029." }, { ...META, scope: "international" }, NOW).item?.deadline, undefined);
});

test("the full text fills gaps for funding and eligibility but never overrides what the title says", () => {
  const raw: RawOpportunity = {
    title: "Study in Hungary 2027",
    url: "https://example.org/hungary",
    kind: "scholarship",
    summary: "A government programme for international students.",
    body: "Benefits: fully funded — tuition, stipend and dormitory. Applicants from Pakistan, India and Nepal are welcome.",
    postedAt: "2026-10-01T00:00:00Z",
  };
  const { item } = normalizeOpportunity(raw, { ...META, scope: "international" }, NOW);
  assert.equal(item?.funding, "full");
  assert.equal(item?.openToPakistan, true);

  const titled = normalizeOpportunity({ ...raw, title: "Partially funded study in Hungary 2027", summary: "Tuition waiver for international students." }, { ...META, scope: "international" }, NOW).item;
  assert.equal(titled?.funding, "partial", "the teaser wins over the long text");
});

test("an empty teaser falls back to the opening of the post as the summary", () => {
  const { item } = normalizeOpportunity(
    { title: "PERA Jobs 2026", url: "https://example.pk/pera", summary: "", body: "<p>The Punjab Enforcement and Regulatory Authority invites applications for 110 posts of managers and officers.</p>" },
    META,
    NOW,
  );
  assert.match(item?.summary ?? "", /Punjab Enforcement and Regulatory Authority/);
});

test("aggregators: openings are kept, how-to articles and exam material are not", () => {
  const params = getSource("jobshah")?.params;
  assert.ok(params?.include && params.exclude, "jobshah has opening/non-opening filters");
  const titles: Array<[string, boolean]> = [
    ["AIOU Jobs 2026 – Latest Allama Iqbal Open University Vacancies, Fee and How to Apply", true],
    ["Excise Taxation & Narcotics Control Department Jobs 2026 – Punjab, Sindh and KPK Vacancies", true],
    ["NADRA Jobs 2026 Online Apply", true],
    ["Ghazi University Jobs 2026 – Walk-in Interviews", true],
    ["Punjab University 2nd Phase Admissions 2026-27 – Undergraduate Programs", true],
    ["Soneri Bank Traineeship Programs 2026", true],
    ["What to Wear to a Job Interview in Pakistan – A Simple Guide for Men and Women", false],
    ["LinkedIn Profile Tips for Pakistani Job Seekers 2026 – Get Found by Recruiters", false],
    ["Cover Letter for Government Jobs in Pakistan 2026 – Do You Really Need One?", false],
    ["PPSC Past Papers 2026 – Where to Find Them, How to Use Them", false],
    ["CSS Exam Syllabus 2026 – Compulsory Subjects, Optional Groups, MPT Pattern", false],
    ["Government Pay Scales in Pakistan (BPS 1–22) – What You Actually Get in Hand", false],
    ["NTS Roll Number Slip 2026 Download", false],
  ];
  const kept = filterFeedItems(titles.map(([title]) => ({ title, url: `https://example.pk/${encodeURIComponent(title)}` })), params, NOW).map((item) => item.title);
  for (const [title, expected] of titles) assert.equal(kept.includes(title), expected, `${expected ? "should keep" : "should drop"}: ${title}`);
});
