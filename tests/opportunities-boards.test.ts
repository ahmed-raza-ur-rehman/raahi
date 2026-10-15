import assert from "node:assert/strict";
import test from "node:test";
import { normalizeOpportunity } from "@/lib/opportunities/normalize";
import { goPunjabAdapter, pakistanJobsBankAdapter, pakistanJobsBankDayPages, parseGoPunjab, parsePakistanJobsBank } from "@/lib/opportunities/scrapers/adapters/boards";
import { HttpError, type HttpClient } from "@/lib/opportunities/scrapers/http";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { getSource } from "@/lib/opportunities/scrapers/sources";
import type { RawOpportunity } from "@/lib/opportunities/types";
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

test("PJB: the day pages linked from the home page are found, newest first, never in the future", () => {
  const pages = pakistanJobsBankDayPages(pjb, "https://www.pakistanjobsbank.com/", at("2026-10-11T06:00:00Z"), 5);
  assert.deepEqual(pages, [
    "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-11/",
    "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-10/",
    "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-09/",
    "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-08/",
    "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-07/",
  ]);
  const early = pakistanJobsBankDayPages(pjb, "https://www.pakistanjobsbank.com/", at("2026-10-05T06:00:00Z"), 3);
  assert.ok(early.every((page) => page <= "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-05/"), "pages dated after today are ignored");
});

test("PJB adapter: home page plus day pages, duplicates merged, a missing day page is logged and skipped", async () => {
  const log: string[] = [];
  const source = { ...getSource("pakistanjobsbank")!, params: { maxAgeDays: 14, dayPages: 3 } };
  const served = createFixtureHttp({
    "https://www.pakistanjobsbank.com/": pjb,
    "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-10/": fixture("pakistanjobsbank.day.sample.html"),
  });
  // the day page for 11 October answers 404; 9 October is served the home page again (the fixture client matches by prefix)
  const http: HttpClient = {
    getText: async (url, options) => {
      if (url.includes("2026-10-11")) throw new HttpError(404, url);
      return served.getText(url, options);
    },
    getJson: served.getJson,
  };
  const items = await pakistanJobsBankAdapter({ source, http, now: at("2026-10-11T06:00:00Z"), log: (line) => log.push(line) });
  assert.equal(items.length, 10, "nine from the home page, one from the day page");
  assert.match(items[0].title, /\(fixture\)/, "newest first");
  assert.ok(log.some((line) => /home page: 9 advertisements/.test(line)));
  assert.ok(log.some((line) => /2026-10-10\/: 1 new advertisements/.test(line)));
  assert.ok(log.some((line) => /2026-10-11\/ unavailable \(HTTP 404/.test(line)));
  assert.ok(log.some((line) => /2026-10-09\/: 0 new advertisements/.test(line)), "a page that repeats known advertisements adds nothing");
  assert.equal(new Set(items.map((item) => item.url)).size, items.length);
});

test("PJB adapter: advertisements older than the age limit are not listed", async () => {
  const source = { ...getSource("pakistanjobsbank")!, params: { maxAgeDays: 14, dayPages: 0 } };
  const http = createFixtureHttp({ "https://www.pakistanjobsbank.com/": pjb });
  const stale = await pakistanJobsBankAdapter({ source, http, now: at("2026-10-30T06:00:00Z"), log: () => undefined });
  assert.equal(stale.length, 0, "04 October is 26 days old on 30 October");
  const fresh = await pakistanJobsBankAdapter({ source, http, now: at("2026-10-15T06:00:00Z"), log: () => undefined });
  assert.equal(fresh.length, 9);
});

test("GoPunjab: cards give organisation, title, seats and the last date; the index link is not a card", () => {
  const items = parseGoPunjab(gopunjab);
  assert.equal(items.length, 3);
  const police = items.find((item) => /Police/.test(item.title)) as RawOpportunity;
  assert.equal(police.title, "Punjab Police — Rahim Yar Khan Police Jobs 2026");
  assert.equal(police.organization, "Punjab Police");
  assert.equal(police.deadline, "2026-10-31");
  assert.equal(police.url, "https://gopunjab.pk/jobs/punjab-police-rahim-yar-khan-rajanpur-jobs-2026/");
  assert.equal(police.extra?.vacancies, 1170);
  assert.match(police.summary ?? "", /1,170 seats/);
  assert.match(police.deadlineText ?? "", /Last date: 31 October 2026/);

  const ppsc = items.filter((item) => /Public Service Commission/.test(item.title));
  assert.equal(ppsc.length, 2);
  assert.ok(ppsc.every((item) => item.deadline === "2026-10-26"));
  assert.ok(!items.some((item) => item.url === "https://gopunjab.pk/jobs/"));
});

test("GoPunjab adapter: a closed advertisement is dropped", async () => {
  const source = getSource("gopunjab")!;
  const http = createFixtureHttp({ "https://gopunjab.pk/": gopunjab });
  const open = await goPunjabAdapter({ source, http, now: at("2026-10-15T06:00:00Z"), log: () => undefined });
  assert.equal(open.length, 3);
  const later = await goPunjabAdapter({ source, http, now: at("2026-10-27T06:00:00Z"), log: () => undefined });
  assert.deepEqual(later.map((item) => item.deadline), ["2026-10-31"]);
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
  assert.ok((bank?.items ?? 0) >= 9);
  assert.equal(punjab?.status, "ok");
  assert.equal(punjab?.items, 3);
  assert.ok(snapshot.items.filter((item) => item.sourceId === "pakistanjobsbank").every((item) => item.openToPakistan === true && item.scope === "pakistan"));
});
