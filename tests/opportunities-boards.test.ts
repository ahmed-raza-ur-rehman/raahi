import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOpportunity } from "@/lib/opportunities/normalize";
import { goPunjabAdapter, pakistanJobsBankAdapter, parseGoPunjab, parsePakistanJobsBank } from "@/lib/opportunities/scrapers/adapters/boards";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { getSource } from "@/lib/opportunities/scrapers/sources";
import { allSourceRoutes, createFixtureHttp, fixture, fixtureSources } from "./helpers/fixture-http";

/**
 * Pakistan Jobs Bank and GoPunjab: two job boards with plain HTML. The fixtures are their real markup, captured from
 * GitHub's runners on 2026-10-11/15.
 */

const at = (iso: string) => new Date(iso);
const pjb = fixture("pakistanjobsbank.sample.html");
const gopunjab = fixture("gopunjab.sample.html");
const META = { id: "pakistanjobsbank", name: "Pakistan Jobs Bank", homepage: "https://www.pakistanjobsbank.com/", defaultKind: "job" as const, scope: "pakistan" as const };

test("PJB: each advertisement row gives a title, a stable link, the newspaper date, the place and the posts", () => {
  const items = parsePakistanJobsBank(pjb);
  assert.equal(items.length, 9);
  const first = items[0];
  assert.match(first.title, /^Chief Minister Punjab IT Internship Program/);
  assert.equal(first.url, "https://www.pakistanjobsbank.com/Jobs/74639/Chief-Minister-Punjab-IT-Internship-Program-October-2026-Apply-Online-Jobs-for-Interns-Latest/");
  assert.equal(first.location, "Punjab, Pakistan");
  assert.equal(first.postedAt, "2026-10-04T00:00:00.000Z");
  assert.match(first.summary ?? "", /Advertised in Dawn on 4 Oct 2026\./);
  assert.ok(first.tags?.includes("dawn"));
  assert.equal(new Set(items.map((item) => item.url)).size, items.length);

  const sindh = items.find((item) => /Criminal Prosecution Services/.test(item.title));
  assert.ok(sindh);
  assert.match(sindh.summary ?? "", /42 Dispatch Riders, 26 Drivers, 41 Daftari/);
  assert.ok(!(sindh.summary ?? "").includes("==="), "grade headings are not posts");
  assert.ok((sindh.summary ?? "").length < 600);
});

test("PJB: the kind of an advertisement comes from its title", () => {
  const now = at("2026-10-11T06:00:00Z");
  const kinds = new Map(parsePakistanJobsBank(pjb).map((raw) => [raw.title.slice(0, 18), normalizeOpportunity(raw, META, now).item?.kind]));
  assert.equal(kinds.get("Chief Minister Pun"), "internship");
  assert.equal(kinds.get("Falak Sufi Scholar"), "scholarship");
  assert.equal(kinds.get("NRSP Microfinance "), "job");
});

test("PJB adapter: newest first, older than the age limit dropped, one request only", async () => {
  const source = getSource("pakistanjobsbank")!;
  const requested: string[] = [];
  const http = createFixtureHttp({ "https://www.pakistanjobsbank.com/": pjb }, requested);
  const fresh = await pakistanJobsBankAdapter({ source, http, now: at("2026-10-15T06:00:00Z"), log: () => undefined });
  assert.equal(fresh.length, 9);
  assert.deepEqual(requested, ["https://www.pakistanjobsbank.com/"], "the 800 KB day archives are not fetched");
  const stale = await pakistanJobsBankAdapter({ source, http, now: at("2026-10-30T06:00:00Z"), log: () => undefined });
  assert.equal(stale.length, 0, "04 October is 26 days old on 30 October");
});

test("GoPunjab: full cards give organisation, title, seats and the last date; plain links and the index are not cards", () => {
  const items = parseGoPunjab(gopunjab, "https://gopunjab.pk/jobs/", at("2026-10-14T06:00:00Z"));
  assert.equal(items.length, 5, "five jobs have a card; the sixth is only a plain link with no date");
  const ppsc = items.find((item) => /Livestock/.test(item.title));
  assert.ok(ppsc);
  assert.equal(ppsc.title, "Punjab Public Service Commission (PPSC) — PPSC Livestock Department Jobs 2026: 61 Senior Veterinary Officer and 40 Veterinary Officer Posts");
  assert.equal(ppsc.organization, "Punjab Public Service Commission (PPSC)");
  assert.equal(ppsc.deadline, "2026-10-26");
  assert.equal(ppsc.url, "https://gopunjab.pk/jobs/ppsc-livestock-department-jobs-2026/");
  assert.equal(ppsc.extra?.vacancies, 101);
  assert.match(ppsc.summary ?? "", /101 seats/);
  assert.ok(!items.some((item) => item.url === "https://gopunjab.pk/jobs/"));
  assert.ok(!items.some((item) => /social-welfare/.test(item.url)));
  assert.equal(new Set(items.map((item) => item.url)).size, items.length, "a job shown twice is listed once");
});

test("GoPunjab: when a job shows twice, the card with an explicit last date wins over the 'days left' badge", () => {
  // On 14 October the compact PSCA card says "1 days left" (→ 14 October by the badge); the full card says 15 October.
  const items = parseGoPunjab(gopunjab, "https://gopunjab.pk/jobs/", at("2026-10-14T06:00:00Z"));
  const psca = items.find((item) => /PSCA/.test(item.title));
  assert.ok(psca);
  assert.equal(psca.deadline, "2026-10-15");
  assert.equal(psca.deadlineText, "Last date: 15 October 2026");
  assert.equal(psca.organization, "Punjab Safe Cities Authority (PSCA)");
});

test("GoPunjab: a job that only has the compact card gets a conservative date from its badge, and says so", () => {
  const compact = '<ul><li><a href="/jobs/example-authority-jobs-2026/"><span>4 days left</span><span>Example Authority Jobs 2026: 10 Posts (fixture)</span><span>Example Authority · 10 seats</span></a></li></ul>';
  const [item] = parseGoPunjab(compact, "https://gopunjab.pk/jobs/", at("2026-10-15T06:00:00Z"));
  assert.equal(item.deadline, "2026-10-18", "inclusive counting: four days left means today plus three");
  assert.match(item.deadlineText ?? "", /About 4 days left \(as shown by GoPunjab\) — confirm the exact date/);
  assert.equal(item.organization, "Example Authority");
  assert.equal(item.extra?.vacancies, 10);

  // 20:00 UTC is already the next day in Pakistan: the UTC date is used, so the result can only be a day early, never late
  const evening = parseGoPunjab(compact, "https://gopunjab.pk/jobs/", at("2026-10-15T20:00:00Z"))[0];
  assert.equal(evening.deadline, "2026-10-18");
  const lastDay = parseGoPunjab(compact.replace("4 days left", "1 days left"), "https://gopunjab.pk/jobs/", at("2026-10-15T06:00:00Z"))[0];
  assert.equal(lastDay.deadline, "2026-10-15", "'1 days left' is the last day itself");
});

test("GoPunjab adapter: closed advertisements are dropped and the rest come soonest first", async () => {
  const source = getSource("gopunjab")!;
  const http = createFixtureHttp({ "https://gopunjab.pk/jobs/": gopunjab });
  const open = await goPunjabAdapter({ source, http, now: at("2026-10-15T06:00:00Z"), log: () => undefined });
  assert.equal(open.length, 5);
  assert.deepEqual(open.map((item) => item.deadline), [...open.map((item) => item.deadline)].sort());
  assert.equal(open[0].deadline, "2026-10-15");
  const later = await goPunjabAdapter({ source, http, now: at("2026-10-27T06:00:00Z"), log: () => undefined });
  assert.equal(later.length, 0, "every card in the sample has closed by 27 October");
});

test("registry and pipeline: both boards are on, flagged experimental, and run offline", async () => {
  for (const id of ["pakistanjobsbank", "gopunjab"]) {
    const source = getSource(id);
    assert.ok(source?.enabled && source.experimental, id);
    assert.equal(source?.network, undefined);
    assert.equal(source?.resourceId, id);
    assert.match(source?.attribution ?? "", /unofficial/i, "the card says these are not official sites");
  }
  const snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes()), now: at("2026-10-11T06:00:00Z"), force: true });
  const bank = snapshot.sources.find((report) => report.sourceId === "pakistanjobsbank");
  const punjab = snapshot.sources.find((report) => report.sourceId === "gopunjab");
  assert.equal(bank?.status, "ok");
  assert.equal(bank?.items, 9);
  assert.equal(punjab?.status, "ok");
  assert.equal(punjab?.items, 5);
  assert.ok(snapshot.items.filter((item) => item.sourceId === "pakistanjobsbank").every((item) => item.openToPakistan === true && item.scope === "pakistan"));
  assert.ok(snapshot.items.filter((item) => item.sourceId === "gopunjab").every((item) => item.deadline !== undefined));
});
