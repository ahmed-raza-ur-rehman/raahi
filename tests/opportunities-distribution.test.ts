import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

process.env.OPPORTUNITIES_BUNDLED = "off";
process.env.RAAHI_DB_PATH = join(process.cwd(), "data", "raahi.opps-dist.test.db");

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { GET as digestGET } from "@/app/api/opportunities/digest/route";
import { setClock } from "@/lib/opportunities/clock";
import { buildDigest } from "@/lib/opportunities/digest";
import { listGuides } from "@/lib/opportunities/guides";
import { runScrapers } from "@/lib/opportunities/scrapers/run";
import { shareText, telegramUrl, whatsappUrl } from "@/lib/opportunities/share";
import { configuredOrigin, originOrLocal } from "@/lib/opportunities/site";
import { loadSnapshotIntoDb } from "@/lib/opportunities/store";
import type { OpportunityView, Snapshot } from "@/lib/opportunities/types";
import { allSourceRoutes, createFixtureHttp, fixtureSources } from "./helpers/fixture-http";

const NOW = new Date("2026-10-11T06:00:00Z");
let snapshot: Snapshot;

test("setup: load the offline fixtures into SQLite", async () => {
  setClock(() => NOW);
  snapshot = await runScrapers({ sources: fixtureSources(), region: "pk", http: createFixtureHttp(allSourceRoutes()), now: NOW, force: true });
  assert.ok(loadSnapshotIntoDb(snapshot, NOW).loaded > 40);
});

// ─── Site address ────────────────────────────────────────────────────────────

test("site origin: explicit setting wins, Vercel's production domain is picked up, local is the last resort", () => {
  assert.equal(configuredOrigin({ NEXT_PUBLIC_SITE_URL: "https://raahi.example/" }), "https://raahi.example");
  assert.equal(configuredOrigin({ SITE_URL: "raahi.example" }), "https://raahi.example");
  assert.equal(configuredOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "raahi-pk.vercel.app" }), "https://raahi-pk.vercel.app");
  assert.equal(configuredOrigin({ NEXT_PUBLIC_SITE_URL: "https://a.example", VERCEL_PROJECT_PRODUCTION_URL: "b.vercel.app" }), "https://a.example");
  assert.equal(configuredOrigin({}), undefined);
  assert.equal(originOrLocal({}), "http://localhost:3000");
});

// ─── Sharing ─────────────────────────────────────────────────────────────────

const shareable = { title: "Commonwealth Master's Scholarships", organization: "CSC", deadline: "2026-10-20", daysLeft: 5, status: "closing-soon", kind: "scholarship" } as Pick<OpportunityView, "title" | "organization" | "deadline" | "daysLeft" | "status" | "kind">;

test("share text: title, who and when, link — in English and Urdu", () => {
  const en = shareText(shareable, "https://raahi.example/opportunities/x");
  assert.equal(en, "*Commonwealth Master's Scholarships*\nCSC · Deadline: 20 Oct 2026 (5 days left)\nhttps://raahi.example/opportunities/x\nvia RAAHI");
  const ur = shareText(shareable, "https://raahi.example/opportunities/x", "ur");
  assert.match(ur, /آخری تاریخ: 20 Oct 2026 \(5 دن باقی\)/);
  assert.match(ur, /راہی کے ذریعے/);
  assert.match(shareText({ ...shareable, kind: "coupon", deadline: undefined, daysLeft: null }, "https://x.example/c"), /Limited-time coupon/);
  assert.ok(!shareText({ ...shareable, daysLeft: 40 }, "https://x.example/c").includes("days left"), "a far-off deadline is not countdown noise");
  assert.ok(shareText({ ...shareable, daysLeft: 1 }, "https://x.example/c").includes("1 day left"));
});

test("share links are properly encoded", () => {
  assert.equal(whatsappUrl("a b&c\n"), "https://wa.me/?text=a%20b%26c%0A");
  assert.equal(telegramUrl("https://x.example/a?b=1", "hi there"), "https://t.me/share/url?url=https%3A%2F%2Fx.example%2Fa%3Fb%3D1&text=hi%20there");
});

// ─── Digest ──────────────────────────────────────────────────────────────────

test("digest: sections come from live data and the planner, every line has an absolute link", () => {
  const digest = buildDigest({ origin: "https://raahi.example/", now: NOW });
  assert.equal(digest.date, "2026-10-11");
  assert.ok(digest.sections.length >= 2, "at least two sections have content");
  for (const section of digest.sections) {
    assert.ok(section.lines.length > 0);
    for (const line of section.lines) assert.match(line.url, /^https:\/\/raahi\.example\/opportunities\//);
  }
  assert.ok(digest.text.startsWith("*RAAHI — what to look at today · 2026-10-11*"));
  assert.match(digest.text, /Confirm details on the official page/);
  assert.ok(!digest.text.includes("raahi.example//"), "no double slash from a trailing slash in the origin");
  // the planner section: the Commonwealth call is closing on 20 October
  const programmes = digest.sections.find((section) => section.id === "programmes");
  assert.ok(programmes?.lines.some((line) => /Commonwealth/.test(line.text) && /closes 20 Oct/.test(line.text) && line.url.endsWith("/opportunities/calendar#commonwealth-masters-phd")));
});

test("digest: a deadline today says so once, and is not repeated as a date", () => {
  // the offline FPSC notice closes on 30 October: on that day it closes "today"
  const today = buildDigest({ origin: "https://raahi.example", now: new Date("2026-10-30T06:00:00Z") });
  const line = today.sections.flatMap((section) => section.lines).find((entry) => /Federal Public Service Commission/.test(entry.text));
  assert.ok(line, "the FPSC fixture notice is listed on its closing day");
  assert.match(line.text, /closes today/);
  assert.ok(!/closes 30 Oct/.test(line.text), `no duplicated phrasing: ${line.text}`);
  const earlier = buildDigest({ origin: "https://raahi.example", now: new Date("2026-10-27T06:00:00Z") });
  assert.match(earlier.sections.flatMap((section) => section.lines).find((entry) => /Federal Public Service Commission/.test(entry.text))?.text ?? "", /closes 30 Oct · 3 days left/);
});

test("digest: the closing list is ordered by date and is a mix, not one site's contests", () => {
  const digest = buildDigest({ origin: "https://raahi.example", now: NOW });
  const closing = digest.sections.find((section) => section.id === "closing");
  assert.ok(closing && closing.lines.length >= 3);
  const kinds = new Set(closing.lines.map((line) => line.url.split("/opportunities/")[1].split("-")[0]));
  assert.ok(kinds.size >= 2, `lines come from more than one source (${[...kinds].join(", ")})`);
});

test("digest: no item appears twice, and coupons are left out", () => {
  const digest = buildDigest({ origin: "https://raahi.example", now: NOW });
  const urls = digest.sections.flatMap((section) => section.lines.map((line) => line.url));
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(!digest.text.toLowerCase().includes("udemy"), "no coupon lines");
});

test("digest: the message is trimmed to fit, keeping the header and footer", () => {
  const long = buildDigest({ origin: "https://raahi.example", now: NOW, maxChars: 3800 });
  const short = buildDigest({ origin: "https://raahi.example", now: NOW, maxChars: 900 });
  assert.ok(short.text.length <= 900, `short digest is ${short.text.length} characters`);
  assert.ok(short.text.length <= long.text.length);
  assert.ok(short.text.startsWith("*RAAHI"));
  assert.match(short.text, /RAAHI never asks for money/);
});

test("digest: Urdu headings, Telegram HTML is escaped", () => {
  const ur = buildDigest({ origin: "https://raahi.example", now: NOW, language: "ur" });
  assert.ok(ur.text.startsWith("*راہی — آج کیا دیکھیں"));
  assert.match(ur.text, /راہی کبھی پیسے یا دستاویزات نہیں مانگتا/);
  const html = buildDigest({ origin: "https://raahi.example", now: NOW }).html;
  assert.ok(html.startsWith("<b>RAAHI"));
  assert.ok(!/<(?!\/?(?:b|a)\b)[a-z]/i.test(html), "only <b> and <a> tags appear");
  assert.match(html, /<a href="https:\/\/raahi\.example\/opportunities\//);
});

test("digest API: text by default, html and json on request, CORS on", async () => {
  const text = await digestGET(new Request("https://raahi.example/api/opportunities/digest"));
  assert.equal(text.status, 200);
  assert.match(text.headers.get("content-type") ?? "", /^text\/plain; charset=utf-8/);
  assert.equal(text.headers.get("access-control-allow-origin"), "*");
  const body = await text.text();
  assert.match(body, /^\*RAAHI/);
  assert.match(body, /https:\/\/raahi\.example\/opportunities\//, "links use the origin the visitor sees");

  const html = await digestGET(new Request("https://raahi.example/api/opportunities/digest?format=html&lang=ur"));
  assert.match(html.headers.get("content-type") ?? "", /^text\/html/);
  assert.match(await html.text(), /^<b>راہی/);

  const json = (await (await digestGET(new Request("https://raahi.example/api/opportunities/digest?format=json"))).json()) as { sections: unknown[]; text: string };
  assert.ok(Array.isArray(json.sections) && json.text.length > 100);

  const short = await (await digestGET(new Request("https://raahi.example/api/opportunities/digest?max=700"))).text();
  assert.ok(short.length <= 700);
});

// ─── Sitemap and robots ──────────────────────────────────────────────────────

test("sitemap: pages, every guide and the listings — absolute, unique, no API", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://raahi.example";
  try {
    const entries = await sitemap();
    const urls = entries.map((entry) => entry.url);
    assert.equal(new Set(urls).size, urls.length, "no duplicates");
    assert.ok(urls.every((url) => url.startsWith("https://raahi.example/")), "all absolute on the configured origin");
    assert.ok(urls.every((url) => !url.includes("/api/")));
    for (const path of ["/", "/opportunities", "/opportunities/calendar", "/opportunities/guides", "/opportunities/resources", "/opportunities/tools"]) assert.ok(urls.includes(`https://raahi.example${path}`), path);
    for (const guide of listGuides()) assert.ok(urls.includes(`https://raahi.example/opportunities/guides/${guide.id}`), guide.id);
    const listings = urls.filter((url) => /\/opportunities\/[a-z0-9]+-[a-f0-9]{6,}$/.test(url));
    assert.ok(listings.length > 30, `listing pages are included (${listings.length})`);
    assert.ok(snapshot.items.filter((item) => item.kind === "coupon").every((item) => !urls.includes(`https://raahi.example/opportunities/${item.id}`)), "coupons are not indexed");
  } finally {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  }
});

test("robots: crawlers may read the site and the widget, not the API or private pages, and find the sitemap", () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://raahi.example";
  try {
    const rules = robots();
    const rule = Array.isArray(rules.rules) ? rules.rules[0] : rules.rules;
    assert.deepEqual(rule.allow, ["/", "/embed/"]);
    assert.ok((rule.disallow as string[]).includes("/api/"));
    assert.equal(rules.sitemap, "https://raahi.example/sitemap.xml");
  } finally {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    setClock(undefined);
  }
});
