import assert from "node:assert/strict";
import test from "node:test";
import { parseFpsc, parsePts, ptsProjectId } from "@/lib/opportunities/scrapers/adapters/pk";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { getSource } from "@/lib/opportunities/scrapers/sources";
import { allSourceRoutes, createFixtureHttp, fixture, fixtureSources } from "./helpers/fixture-http";

/**
 * FPSC and PTS: two federal/provincial recruiters whose pages draw their lists with JavaScript. The parsers read the
 * public JSON those pages load, captured from GitHub's runners on 2026-10-15.
 */

const fpsc = JSON.parse(fixture("fpsc-jobs.sample.json")) as unknown;
const pts = JSON.parse(fixture("pts-projects.sample.json")) as unknown;
const at = (iso: string) => new Date(iso);

test("FPSC: the real archive, read as of mid-August 2026, has two open notices", () => {
  const items = parseFpsc(fpsc, at("2026-08-15T06:00:00Z"));
  assert.equal(items.length, 2);

  const advert = items.find((item) => item.title.includes("No. 3/2026"));
  assert.ok(advert);
  assert.equal(advert.kind, "job");
  assert.equal(advert.scope, "pakistan");
  assert.equal(advert.deadline, "2026-09-01");
  assert.equal(advert.organization, "Federal Public Service Commission");
  assert.equal(advert.url, "https://www.fpsc.gov.pk/uploads/content/1786536972642_consolidated_Advertisement_No._3-2026.pdf", "links to the advertisement itself, not the fee or guideline PDFs");
  assert.equal(advert.applyUrl, "https://cp.fpsc.gov.pk/gr_one/index_gr.php");
  assert.equal(advert.postedAt, "2026-08-13T00:00:00.000Z");

  const css = items.find((item) => item.title.includes("MPT"));
  assert.ok(css);
  assert.equal(css.deadline, "2026-08-21");
  assert.equal(css.applyUrl, "https://cp.fpsc.gov.pk/gr_one/index.php");
  assert.ok(css.tags?.includes("css"));
});

test("FPSC: as of the day it was captured nothing is open, exactly like the live endpoint", () => {
  assert.deepEqual(parseFpsc(fpsc, at("2026-10-15T06:00:00Z")), []);
  assert.deepEqual(parseFpsc({ success: true, data: [] }), []);
  assert.deepEqual(parseFpsc("not json"), []);
  assert.deepEqual(parseFpsc({ data: "nope" }), []);
});

test("FPSC: rules, schedules and results are not openings, and every item has a distinct address", () => {
  const items = parseFpsc(fpsc, at("2026-04-01T06:00:00Z"));
  const titles = items.map((item) => item.title);
  assert.ok(titles.some((title) => title.includes("Project Manager")), "a 'situation vacant' notice is an opening");
  assert.ok(!titles.some((title) => /Section Officers Promot/i.test(title)), "promotion-exam rules are not listed");
  assert.equal(new Set(items.map((item) => item.url)).size, items.length, "no two items share an address");
});

test("FPSC: a notice without a PDF still gets a stable, unique address", () => {
  const raw = { data: [{ id: 7, category: "GR", title: "Special Advertisement", date: "2026-03-09", description: "<p>No links here</p>", expiryDate: "2026-03-31" }, { id: 8, category: "GR", title: "Special Advertisement", date: "2026-03-09", description: "", expiryDate: "2026-03-31" }] };
  const items = parseFpsc(raw, at("2026-03-10T06:00:00Z"));
  assert.equal(items.length, 2);
  assert.match(items[0].url, /^https:\/\/www\.fpsc\.gov\.pk\/Jobs\?section=GR&ref=7$/);
  assert.notEqual(items[0].url, items[1].url);
});

test("PTS: project pages are addressed by the id base64-encoded nine times, like the site does", () => {
  const encoded = ptsProjectId(373);
  let decoded = encoded;
  for (let round = 0; round < 9; round += 1) decoded = Buffer.from(decoded, "base64").toString("utf8");
  assert.equal(decoded, "373");
  assert.match(encoded, /^Vm0w/, "same prefix as the real links on pts.org.pk");
});

test("PTS: finished projects carry a placeholder date and are not listed; one with a real future date is", () => {
  const items = parsePts(pts, at("2026-10-15T06:00:00Z"));
  assert.equal(items.length, 1, "only the (fixture) project has a real date");
  const [item] = items;
  assert.equal(item.deadline, "2026-10-30");
  assert.equal(item.kind, "job");
  assert.match(item.title, /recruitment test through PTS \(project 999\)/);
  assert.ok(!/\(999\)\s*\(/.test(item.organization ?? ""), "the project code is moved out of the organisation name");
  assert.equal(item.url, `https://www.pts.org.pk/Projects/Details/${ptsProjectId(380)}`);
});

test("PTS: a past date is dropped, and a date format we cannot read is reported, not guessed", () => {
  const unreadable: string[] = [];
  const raw = [
    { ID: 1, name: "Old Department (OLD) (100)", lastDate: "05-09-2026" },
    { ID: 2, name: "Odd Department (ODD) (101)", lastDate: "soon-ish" },
    { ID: 3, name: "Fresh Department (FRS) (102)", lastDate: "Oct 28, 2026" },
    { ID: 4, name: "Blank Department (BLK) (103)", lastDate: "" },
    { ID: 5, name: "Dots Department (DOT) (104)", lastDate: "......" },
  ];
  const items = parsePts(raw, at("2026-10-15T06:00:00Z"), (value) => unreadable.push(value));
  assert.deepEqual(items.map((item) => item.deadline), ["2026-10-28"]);
  assert.deepEqual(unreadable, ["soon-ish"]);
});

test("registry: both sources are on, flagged experimental, linked to their directory entries", () => {
  for (const id of ["fpsc", "pts"]) {
    const source = getSource(id);
    assert.ok(source?.enabled, `${id} enabled`);
    assert.equal(source?.experimental, true);
    assert.equal(source?.network, undefined, `${id} is reachable from GitHub's runners`);
    assert.equal(source?.resourceId, id);
  }
});

test("pipeline: both sources run through the whole offline pipeline", async () => {
  const snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes()), now: at("2026-10-11T06:00:00Z"), force: true });
  for (const id of ["fpsc", "pts"]) {
    const report = snapshot.sources.find((source) => source.sourceId === id);
    assert.equal(report?.status, "ok", `${id}: ${report?.error ?? report?.note}`);
    assert.equal(report?.items, 1);
  }
  assert.ok(snapshot.items.some((item) => item.sourceId === "fpsc" && item.deadline === "2026-10-30"));
  assert.ok(snapshot.items.some((item) => item.sourceId === "pts" && item.openToPakistan === true));
});

test("a commission with nothing open is 'ok, nothing open' — a changed response is an error, a blank page is still 'empty'", async () => {
  const fpscSource = fixtureSources().find((source) => source.id === "fpsc")!;
  const run = (body: string, source = fpscSource) => runScrapers({ sources: [source], region: "pk", http: createFixtureHttp({ "https://www.fpsc.gov.pk/api/jobs": body }), now: at("2026-10-15T06:00:00Z"), force: true });

  const quiet = (await run('{"success":true,"data":[]}')).sources[0];
  assert.equal(quiet.status, "ok");
  assert.equal(quiet.items, 0);
  assert.match(quiet.note ?? "", /no notice is open right now/);
  assert.ok(quiet.lastSuccessAt);

  const changed = (await run('{"ok":true,"jobs":[]}')).sources[0];
  assert.equal(changed.status, "error", "a response without the list means the site changed");
  assert.match(changed.error ?? "", /may have changed/);

  // the same empty answer from a source that has not declared it normal stays a warning
  const strict = (await run('{"success":true,"data":[]}', { ...fpscSource, params: {} })).sources[0];
  assert.equal(strict.status, "empty");

  const pts = fixtureSources().find((source) => source.id === "pts")!;
  const ptsRun = await runScrapers({ sources: [pts], region: "pk", http: createFixtureHttp({ "https://www.pts.org.pk/Projects/getProjects/": '[{"ID":1,"name":"Done (1)","lastDate":"......"}]' }), now: at("2026-10-15T06:00:00Z"), force: true });
  assert.equal(ptsRun.sources[0].status, "ok", "finished projects only: nothing open, not a failure");
  const notAList = await runScrapers({ sources: [pts], region: "pk", http: createFixtureHttp({ "https://www.pts.org.pk/Projects/getProjects/": '{"error":"x"}' }), now: at("2026-10-15T06:00:00Z"), force: true });
  assert.equal(notAList.sources[0].status, "error");
});

