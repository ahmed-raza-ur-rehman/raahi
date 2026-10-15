import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import { GET as flagshipsGET } from "@/app/api/opportunities/flagships/route";
import { setClock } from "@/lib/opportunities/clock";
import { buildPlanner, flagshipStatus, getFlagship, inWindow, listFlagships, monthsUntil, searchFlagships, summarizeFlagship, windowStrip } from "@/lib/opportunities/flagships";
import { getGuide } from "@/lib/opportunities/guides";

/**
 * The yearly planner. The data tests guard honesty (every date says how sure we are and when it was checked, no
 * invented money figures, Urdu present); the logic tests pin the clock so they stay true after the dates pass.
 */

const at = (iso: string) => new Date(iso);
const TODAY = at("2026-10-15T06:00:00Z"); // 11:00 in Pakistan
afterEach(() => setClock(undefined));

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ARABIC_SCRIPT = /[\u0600-\u06FF]/;

test("data: ids are unique, links are https, months are valid, every entry has a window and a route", () => {
  const all = listFlagships();
  assert.ok(all.length >= 24, "a useful number of programmes");
  assert.equal(new Set(all.map((f) => f.id)).size, all.length);
  for (const f of all) {
    assert.match(f.official, /^https:\/\//, `${f.id}: official link is https`);
    assert.ok(f.windows.length > 0, `${f.id}: has a usual window`);
    for (const w of f.windows) {
      assert.ok(Number.isInteger(w.from) && w.from >= 1 && w.from <= 12, `${f.id}: from`);
      assert.ok(Number.isInteger(w.to) && w.to >= 1 && w.to <= 12, `${f.id}: to`);
    }
    assert.ok(f.prepMonths >= 0 && f.prepMonths <= 12, `${f.id}: prepMonths`);
    assert.ok(f.prep.length >= 2, `${f.id}: has a preparation checklist`);
    assert.match(f.reviewed, ISO, `${f.id}: reviewed date`);
    assert.ok(f.tags.length >= 3, `${f.id}: searchable tags`);
  }
});

test("data: every text exists in English and in Urdu script", () => {
  for (const f of listFlagships()) {
    const texts = [f.title, f.where, f.summary, f.routeNote, f.windowNote, ...f.prep, ...(f.cycle ? [f.cycle.label, ...(f.cycle.note ? [f.cycle.note] : []), ...(f.cycle.closesNote ? [f.cycle.closesNote] : [])] : [])];
    for (const text of texts) {
      assert.ok(text.en.trim().length > 2, `${f.id}: English text`);
      assert.match(text.ur, ARABIC_SCRIPT, `${f.id}: Urdu text is in Urdu script (${text.en.slice(0, 40)})`);
    }
  }
});

test("data: every date says how sure we are, when it was checked, and where it comes from", () => {
  for (const f of listFlagships().filter((entry) => entry.cycle)) {
    const cycle = f.cycle!;
    assert.ok(cycle.confidence === "official" || cycle.confidence === "reported", `${f.id}: confidence`);
    assert.match(cycle.checked, ISO, `${f.id}: checked`);
    assert.match(cycle.sourceUrl, /^https:\/\//, `${f.id}: source link`);
    for (const date of [cycle.opens, cycle.closes].filter(Boolean) as string[]) assert.match(date, ISO, `${f.id}: ${date}`);
    if (cycle.opens && cycle.closes) assert.ok(cycle.opens <= cycle.closes, `${f.id}: opens before it closes`);
    assert.ok(cycle.opens || cycle.closes, `${f.id}: a cycle has at least one date`);
  }
  // only a date read on the organiser's own page may be called official
  const official = listFlagships().filter((f) => f.cycle?.confidence === "official");
  assert.ok(official.every((f) => /emb-japan\.go\.jp|\.gov\./.test(f.cycle!.sourceUrl)), "official dates come from an official domain");
});

test("data: no invented money — fees, stipends and quotas are not stated", () => {
  const CURRENCY = /[$€£]\s?\d|\b(?:USD|GBP|EUR|PKR|HUF|TL)\b|\bRs\.?\s?\d|\d\s?(?:USD|GBP|EUR|PKR)\b/;
  for (const f of listFlagships()) {
    const blob = JSON.stringify(f);
    assert.doesNotMatch(blob, CURRENCY, `${f.id} mentions an amount of money`);
  }
});

test("data: guides linked from programmes exist", () => {
  for (const f of listFlagships()) {
    for (const id of f.guides ?? []) assert.ok(getGuide(id), `${f.id} links to a missing guide "${id}"`);
  }
});

test("month arithmetic wraps over New Year", () => {
  assert.equal(inWindow(12, { from: 11, to: 1 }), true);
  assert.equal(inWindow(1, { from: 11, to: 1 }), true);
  assert.equal(inWindow(2, { from: 11, to: 1 }), false);
  assert.equal(inWindow(3, { from: 3, to: 3 }), true);
  assert.equal(monthsUntil(10, 8), 10);
  assert.equal(monthsUntil(10, 10), 0);
  assert.equal(monthsUntil(12, 1), 1);
  assert.deepEqual(windowStrip({ windows: [{ from: 11, to: 1 }] }).map((on) => (on ? 1 : 0)), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
});

test("status on 15 Oct 2026: the Commonwealth call is closing in five days", () => {
  const status = flagshipStatus(getFlagship("commonwealth-masters-phd")!, TODAY);
  assert.equal(status.phase, "closing-soon");
  assert.equal(status.daysLeft, 5);
});

test("status on 15 Oct 2026: Chevening has closed and is not yet time to prepare for the next one", () => {
  const status = flagshipStatus(getFlagship("chevening")!, TODAY);
  assert.equal(status.phase, "closed");
  // October is inside the usual August–October window, but the call itself closed on 6 October: next one is next year's
  assert.equal(status.monthsToOpen, 10);
  assert.equal(status.nextOpensMonth, 8);
  assert.equal(status.prepareNow, false);
});

test("status on 15 Oct 2026: an announced call that has not opened yet is 'upcoming'", () => {
  const css = flagshipStatus(getFlagship("css-fpsc")!, TODAY);
  assert.equal(css.phase, "upcoming");
  assert.equal(css.daysToOpen, 26);
  assert.equal(css.prepareNow, true);
  // a known deadline with no opening date, and the usual window still ahead, is also upcoming
  const hungary = flagshipStatus(getFlagship("stipendium-hungaricum")!, TODAY);
  assert.equal(hungary.phase, "upcoming");
  assert.equal(hungary.prepareNow, true);
});

test("status on 15 Oct 2026: an event that has opened and ends later is open", () => {
  const nasa = flagshipStatus(getFlagship("nasa-space-apps")!, TODAY);
  assert.equal(nasa.phase, "open");
  assert.equal(nasa.daysLeft, 30);
});

test("status on 15 Oct 2026: programmes without fixed dates use the usual window and the preparation lead time", () => {
  assert.equal(flagshipStatus(getFlagship("daad-germany")!, TODAY).phase, "typically-open"); // August–December
  const kp = flagshipStatus(getFlagship("kppsc-pms")!, TODAY); // December–January
  assert.equal(kp.phase, "off-season");
  assert.equal(kp.monthsToOpen, 2);
  assert.equal(kp.prepareNow, true);
  const gsoc = flagshipStatus(getFlagship("gsoc")!, TODAY); // March, five months of lead time
  assert.equal(gsoc.monthsToOpen, 5);
  assert.equal(gsoc.prepareNow, true);
});

test("a cycle that ended long ago does not hide the next year's window", () => {
  // Türkiye Bursları: the stored call closed on 20 Feb 2026, and in Feb 2027 the usual window is open again.
  assert.equal(flagshipStatus(getFlagship("turkiye-burslari")!, at("2026-10-15T06:00:00Z")).phase, "closed");
  assert.equal(flagshipStatus(getFlagship("turkiye-burslari")!, at("2027-02-10T06:00:00Z")).phase, "typically-open");
  // …but a call that closed last month is closed even if the usual window is nominally still on
  assert.equal(flagshipStatus(getFlagship("commonwealth-masters-phd")!, at("2026-10-25T06:00:00Z")).phase, "closed");
});

test("planner: every programme appears exactly once, most urgent first", () => {
  const planner = buildPlanner(undefined, TODAY);
  const all = [...planner.act, ...planner.soon, ...planner.prepare, ...planner.later];
  assert.equal(all.length, listFlagships().length);
  assert.equal(new Set(all.map((entry) => entry.flagship.id)).size, all.length);
  assert.equal(planner.today, "2026-10-15");
  assert.equal(planner.month, 10);
  assert.equal(planner.act[0].flagship.id, "commonwealth-masters-phd", "the call closing in five days leads");
  const phases = planner.act.map((entry) => entry.status.phase);
  assert.deepEqual(phases, [...phases].sort((a, b) => ["closing-soon", "open", "typically-open"].indexOf(a) - ["closing-soon", "open", "typically-open"].indexOf(b)));
  const soonIds = planner.soon.map((entry) => entry.flagship.id);
  assert.ok(soonIds.includes("css-fpsc") && soonIds.includes("stipendium-hungaricum"));
  const soonest = planner.soon.map((entry) => entry.status.daysToOpen ?? entry.status.monthsToOpen * 30);
  assert.deepEqual(soonest, [...soonest].sort((a, b) => a - b), "upcoming calls are ordered by how soon they open");
  assert.ok(planner.prepare.every((entry) => entry.status.prepareNow));
});

test("planner follows the clock: on 20 Feb 2027 Chevening is in its preparation window and Fulbright is open", () => {
  setClock(() => at("2027-02-20T06:00:00Z"));
  const chevening = flagshipStatus(getFlagship("chevening")!);
  assert.equal(chevening.monthsToOpen, 6); // February → August
  assert.equal(chevening.prepareNow, true);
  assert.equal(flagshipStatus(getFlagship("fulbright-pakistan")!).phase, "typically-open");
});

test("search: names, providers, Urdu and Roman-Urdu words find the right programme", () => {
  const first = (q: string, extra = {}) => searchFlagships({ q, ...extra }, TODAY)[0]?.flagship.id;
  assert.equal(first("chevening"), "chevening");
  assert.equal(first("fulbright usa"), "fulbright-pakistan");
  assert.equal(first("german scholarship daad"), "daad-germany");
  assert.equal(first("فل برائٹ"), "fulbright-pakistan");
  assert.equal(first("css exam fpsc"), "css-fpsc");
  assert.equal(first("pms kpk abbottabad"), "kppsc-pms");
  assert.equal(first("mdcat"), "mdcat");
  assert.equal(first("hat test hec"), "hec-hat");
  assert.equal(first("zzzzqqqq"), undefined);
});

test("search: filters by kind, level and route", () => {
  const admissions = searchFlagships({ kind: "admission" }, TODAY).map((entry) => entry.flagship.id);
  assert.ok(admissions.includes("mdcat") && admissions.includes("ecat-uet") && admissions.includes("hec-hat"));
  assert.ok(searchFlagships({ kind: "admission" }, TODAY).every((entry) => entry.flagship.kind === "admission"));
  assert.ok(searchFlagships({ level: "phd" }, TODAY).every((entry) => entry.flagship.levels.includes("phd")));
  assert.ok(searchFlagships({ route: "hec" }, TODAY).every((entry) => entry.flagship.route === "hec"));
  assert.ok(searchFlagships({ route: "hec" }, TODAY).length >= 3);
});

test("summaries carry the honesty fields and respect the language", () => {
  const entry = searchFlagships({ q: "commonwealth" }, TODAY)[0];
  const en = summarizeFlagship(entry, "en");
  const ur = summarizeFlagship(entry, "ur");
  assert.equal(en.cycle?.confidence, "reported");
  assert.equal(en.cycle?.checked, "2026-10-15");
  assert.match(en.routeNote, /BOTH/);
  assert.match(ur.title, /[\u0600-\u06FF]/);
  assert.equal(en.phase, "closing-soon");
  assert.ok(en.prepare.length >= 3);
});

test("API: returns the planner, honours filters and sends CORS headers", async () => {
  setClock(() => TODAY);
  const response = await flagshipsGET(new Request("http://localhost/api/opportunities/flagships?q=chevening&lang=ur"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  const body = (await response.json()) as { today: string; total: number; counts: Record<string, number>; items: Array<{ id: string; title: string; phase: string }> };
  assert.equal(body.today, "2026-10-15");
  assert.equal(body.items[0].id, "chevening");
  assert.equal(body.items[0].phase, "closed");
  assert.match(body.items[0].title, /[\u0600-\u06FF]/);
  assert.ok(body.counts.act >= 3);

  const filtered = (await (await flagshipsGET(new Request("http://localhost/api/opportunities/flagships?kind=admission&limit=2"))).json()) as { items: Array<{ kind: string }>; total: number };
  assert.equal(filtered.total, 2);
  assert.ok(filtered.items.every((item) => item.kind === "admission"));
  const junk = (await (await flagshipsGET(new Request("http://localhost/api/opportunities/flagships?kind=nonsense&level=nope"))).json()) as { total: number };
  assert.equal(junk.total, listFlagships().length, "unknown filter values are ignored, not an error");
});
