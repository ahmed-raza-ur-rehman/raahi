/**
 * TEMPORARY live probe. It runs on GitHub's runners (which have normal internet access), never on a laptop
 * or in the agent sandbox, and it is removed before the branch is merged.
 *
 * Why it exists: the scrapers for sites without a documented API were written from rendered pages, and the
 * development sandbox cannot reach those sites. This script runs the real pipeline against the real
 * sites, and sweeps a list of candidate sources, so the parsers can be tuned against real responses.
 *
 * It is as polite as the production scraper: honest User-Agent, robots.txt obeyed (only documented public
 * APIs skip it), one request per host per second, small timeouts, and it gives up on a site that refuses.
 * What it records is metadata (status, content type, a few titles) plus trimmed page samples used to write
 * parser fixtures. Output goes to `.probe/`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resources } from "../data/opportunities/resources";
import { checkResources } from "../lib/opportunities/linkcheck";
import { parseFeed } from "../lib/opportunities/scrapers/adapters/feeds";
import { cheerio } from "../lib/opportunities/scrapers/dom";
import { createHttpClient, HttpError, RobotsDisallowedError, ROBOTS_TOKEN, USER_AGENT, type HttpClient } from "../lib/opportunities/scrapers/http";
import { isAllowed, parseRobots } from "../lib/opportunities/scrapers/robots";
import { runScrapers } from "../lib/opportunities/scrapers/run";
import { readSnapshotFile, writeSnapshotFile } from "../lib/opportunities/snapshot";

const OUT = process.env.PROBE_OUT ?? ".probe";
const STEPS = new Set((process.env.PROBE_STEPS ?? "scrape,pages,apis,discovery,links").split(","));

type Group = "pk-official" | "pk-aggregator" | "global-blog" | "global-board";
interface Site {
  group: Group;
  base: string;
  /** Keep a trimmed copy of the home page (used to write a parser). */
  keepHtml?: boolean;
}

const site = (group: Group, base: string, keepHtml = false): Site => ({ group, base, keepHtml });

const SITES: Site[] = [
  // Round 2: more Pakistani aggregators and scholarship/internship portals
  site("pk-aggregator", "https://pakkijobs.pk", true),
  site("pk-aggregator", "https://jobs.com.pk", true),
  site("pk-aggregator", "https://www.pakadmissions.com", true),
  site("pk-aggregator", "https://www.pakistanjobsbank.com", true),
  site("pk-aggregator", "https://jobexplain.com"),
  site("pk-aggregator", "https://generalknowledge.online"),
  site("pk-aggregator", "https://theneutral.pk"),
  site("pk-aggregator", "https://www.pitb.gov.pk"),
  site("pk-official", "https://ehsaas.hec.gov.pk", true),
  site("pk-official", "https://www.pof.gov.pk", true),
  site("pk-official", "https://www.pac.org.pk", true),
  site("pk-official", "https://www.nust.edu.pk"),
  site("global-blog", "https://www.youthop.com", true),
  site("global-blog", "https://www.fellowshipsandgrants.org"),
  site("global-blog", "https://www.opportunitiesforyouth.org"),
];

interface ApiTarget {
  id: string;
  url: string;
  /** Only documented public APIs / feeds may skip robots.txt (same rule as the production registry). */
  documented: boolean;
}

const API_TARGETS: ApiTarget[] = [
  { id: "himalayas-api", url: "https://himalayas.app/jobs/api?limit=3", documented: true },
  { id: "himalayas-rss", url: "https://himalayas.app/jobs/rss", documented: true },
  { id: "remoteok", url: "https://remoteok.com/api", documented: true },
  { id: "weworkremotely", url: "https://weworkremotely.com/remote-jobs.rss", documented: true },
  { id: "workingnomads", url: "https://www.workingnomads.com/api/exposed_jobs/", documented: false },
  { id: "themuse", url: "https://www.themuse.com/api/public/jobs?page=1&descending=true", documented: true },
  { id: "ctftime", url: "https://ctftime.org/api/v1/events/?limit=5", documented: true },
  { id: "topcoder", url: "https://api.topcoder.com/v5/challenges?perPage=5&status=Active", documented: true },
  { id: "reliefweb-v2", url: "https://api.reliefweb.int/v2/jobs?appname=raahi-probe&limit=2&preset=latest&profile=list", documented: true },
  { id: "mlh-events", url: "https://mlh.io/seasons/2026/events", documented: false },
];

/** Listing / detail pages whose real HTML is needed to write or fix a parser. */
const PAGES: Array<{ id: string; url: string; follow?: RegExp }> = [
  { id: "kppsc-advertisement", url: "https://www.kppsc.gov.pk/advertisement" },
  { id: "bpsc-jobs", url: "https://bpsc.gob.pk/BPSC/pages?jobs" },
  { id: "pts-projects", url: "https://www.pts.org.pk/Projects/" },
  { id: "spsc-advertisements", url: "https://spsc.gos.pk/advertisement.php" },
  { id: "mlh-events", url: "https://mlh.io/seasons/2026/events" },
  { id: "etea-home", url: "https://www.etea.edu.pk/" },
];

const sleepless = createHttpClient({ timeoutMs: 15_000, retries: 0, hostDelayMs: 1_000 });

function slug(text: string): string {
  return text.replace(/^https?:\/\//, "").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 70);
}

function write(path: string, content: string) {
  mkdirSync(path.split("/").slice(0, -1).join("/") || ".", { recursive: true });
  writeFileSync(path, content, "utf8");
}

function errorNote(error: unknown): { status: number; note: string } {
  if (error instanceof RobotsDisallowedError) return { status: 0, note: "robots.txt disallows us" };
  if (error instanceof HttpError) return { status: error.status, note: error.message.slice(0, 160) };
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause?.code;
  return { status: 0, note: `${error instanceof Error ? error.message : "error"}${cause ? ` (${cause})` : ""}`.slice(0, 160) };
}

/** Strip scripts/styles/svg and collapse whitespace so a small sample still shows the real structure. */
function cleanHtml(html: string, max: number): string {
  const $ = cheerio.load(html);
  $("script, style, svg, noscript, iframe, link[rel=stylesheet], link[rel=preload], link[rel=prefetch], meta, img, picture, source").remove();
  $("*").each((_, node) => {
    const element = $(node);
    for (const name of Object.keys(element.attr() ?? {})) {
      if (/^(data-|on|aria-|style$|srcset$|integrity$|crossorigin$|nonce$)/i.test(name)) element.removeAttr(name);
    }
  });
  const body = $.html().replace(/\s+/g, " ").replace(/> </g, ">\n<");
  return body.length > max ? `${body.slice(0, max)}\n<!-- trimmed -->` : body;
}

interface Attempt {
  url: string;
  ok: boolean;
  status: number;
  contentType?: string;
  bytes?: number;
  finalUrl?: string;
  note?: string;
  sample?: unknown;
}

async function attempt(http: HttpClient, url: string, options: { robots?: boolean; accept?: string } = {}): Promise<{ result: Attempt; text?: string }> {
  try {
    const response = await http.getText(url, { respectRobots: options.robots !== false, accept: options.accept });
    return {
      result: { url, ok: true, status: response.status, contentType: response.contentType.split(";")[0], bytes: response.text.length, finalUrl: response.url !== url ? response.url : undefined },
      text: response.text,
    };
  } catch (error) {
    return { result: { url, ok: false, ...errorNote(error) } };
  }
}

interface SiteResult {
  group: Group;
  base: string;
  robots: { status: number; allowsHome?: boolean; allowsWpJson?: boolean; allowsFeed?: boolean; crawlDelay?: number; sitemaps?: string[]; note?: string };
  home?: Attempt & { title?: string; generator?: string; links?: number; feedLinks?: string[] };
  wpJson?: Attempt;
  feed?: Attempt;
  verdict: string;
}

function textOf(html: string | undefined): string {
  return cheerio.load(`<p>${html ?? ""}</p>`)("p").text().replace(/\s+/g, " ").trim();
}

async function probeSite(candidate: Site): Promise<SiteResult> {
  const { base } = candidate;
  const result: SiteResult = { group: candidate.group, base, robots: { status: 0 }, verdict: "" };
  const host = new URL(base).host;

  const robots = await attempt(sleepless, `${base}/robots.txt`, { robots: false, accept: "text/plain" });
  result.robots.status = robots.result.status;
  if (robots.text) {
    const rules = parseRobots(robots.text.slice(0, 512 * 1024));
    result.robots.allowsHome = isAllowed(rules, ROBOTS_TOKEN, "/");
    result.robots.allowsWpJson = isAllowed(rules, ROBOTS_TOKEN, "/wp-json/wp/v2/posts?per_page=3");
    result.robots.allowsFeed = isAllowed(rules, ROBOTS_TOKEN, "/feed/");
    result.robots.sitemaps = rules.sitemaps.slice(0, 3);
  } else if (!robots.result.ok) {
    result.robots.note = robots.result.note;
    if (robots.result.status === 0) {
      result.verdict = `unreachable from the runner: ${robots.result.note}`;
      return result;
    }
  }
  if (result.robots.allowsHome === false) {
    result.verdict = "robots.txt disallows our bot on the home page — do not scrape";
    return result;
  }

  const home = await attempt(sleepless, `${base}/`);
  result.home = { ...home.result };
  if (home.text) {
    const $ = cheerio.load(home.text);
    result.home.title = $("title").first().text().replace(/\s+/g, " ").trim().slice(0, 140);
    result.home.generator = $("meta[name=generator]").attr("content")?.slice(0, 60);
    result.home.links = $("a[href]").length;
    result.home.feedLinks = $("link[rel=alternate][type*=rss], link[rel=alternate][type*=atom]")
      .map((_, node) => $(node).attr("href") ?? "")
      .get()
      .filter(Boolean)
      .slice(0, 4)
      .map((href) => new URL(href, `${base}/`).toString());
    if (candidate.keepHtml) write(`${OUT}/html/${slug(host)}.html`, cleanHtml(home.text, 70_000));
  }
  if (!home.result.ok && home.result.status === 0) {
    result.verdict = `home page unreachable: ${home.result.note}`;
    return result;
  }

  if (result.robots.allowsWpJson !== false) {
    const wp = await attempt(sleepless, `${base}/wp-json/wp/v2/posts?per_page=3&_fields=id,date_gmt,link,title,excerpt`, { accept: "application/json" });
    result.wpJson = { ...wp.result };
    if (wp.text) {
      try {
        const posts = JSON.parse(wp.text) as Array<{ date_gmt?: string; link?: string; title?: { rendered?: string }; excerpt?: { rendered?: string } }>;
        result.wpJson.sample = posts.slice(0, 3).map((post) => ({ date: post.date_gmt, title: textOf(post.title?.rendered).slice(0, 110), link: post.link, excerpt: textOf(post.excerpt?.rendered).slice(0, 160) }));
        result.wpJson.ok = Array.isArray(posts) && posts.length > 0;
      } catch {
        result.wpJson.ok = false;
        result.wpJson.note = "not JSON";
      }
    }
  }

  const feedCandidates = [...(result.home?.feedLinks ?? []), `${base}/feed/`, `${base}/rss.xml`, `${base}/feed.xml`, `${base}/feeds/posts/default`].filter((url, index, all) => all.indexOf(url) === index).slice(0, 4);
  if (result.robots.allowsFeed !== false) {
    for (const url of feedCandidates) {
      const feed = await attempt(sleepless, url, { accept: "application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5" });
      if (!feed.text) {
        result.feed ??= feed.result;
        continue;
      }
      const items = parseFeed(feed.text);
      if (items.length > 0) {
        result.feed = { ...feed.result, sample: items.slice(0, 3).map((item) => ({ title: item.title.slice(0, 110), link: item.link, published: item.published, categories: item.categories.slice(0, 4) })), note: `${items.length} items` };
        break;
      }
    }
  }

  const bits = [];
  if (result.wpJson?.ok) bits.push("WP-JSON ✔");
  if (result.feed?.ok && result.feed.sample) bits.push("feed ✔");
  if (result.home?.ok) bits.push(`home ${result.home.status}`);
  else bits.push(`home ${result.home?.status ?? "?"}${result.home?.note ? ` (${result.home.note})` : ""}`);
  result.verdict = bits.join(", ");
  return result;
}

async function pool<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        results[index] = await work(items[index]);
      }
    }),
  );
  return results;
}

async function stepScrape() {
  console.log("\n=== 1/5 Real scrape of the production registry ===");
  const previous = readSnapshotFile();
  const snapshot = await runScrapers({ previous, force: true, onProgress: (line) => console.log(line) });
  writeSnapshotFile(snapshot, `${OUT}/snapshot.live.json`);
  const lines = ["# Real scrape (production registry)", "", `Generated ${snapshot.generatedAt}; ${snapshot.items.length} items kept (previous snapshot had ${previous.items.length}).`, "", "| source | status | items | seconds | notes |", "|---|---|---|---|---|"];
  for (const report of snapshot.sources) {
    lines.push(`| ${report.sourceId} | ${report.status} | ${report.items} | ${(report.durationMs / 1000).toFixed(1)} | ${(report.error ?? report.note ?? "").replace(/\|/g, "/").slice(0, 200)} |`);
  }
  const bySource = new Map<string, number>();
  for (const item of snapshot.items) bySource.set(item.sourceId, (bySource.get(item.sourceId) ?? 0) + 1);
  lines.push("", "Items per source in the merged snapshot:", "", [...bySource].map(([id, count]) => `${id}: ${count}`).join(", "));
  write(`${OUT}/scrape-report.md`, `${lines.join("\n")}\n`);
  console.log(lines.join("\n"));
}

async function stepPages() {
  console.log("\n=== 2/5 Real HTML for the page-based parsers ===");
  for (const page of PAGES) {
    const first = await attempt(sleepless, page.url);
    console.log(`${page.id}: ${first.result.ok ? `HTTP ${first.result.status}, ${first.result.bytes} bytes` : `FAILED ${first.result.status} ${first.result.note}`}`);
    if (!first.text) {
      write(`${OUT}/pages/${page.id}.error.txt`, JSON.stringify(first.result, null, 2));
      continue;
    }
    write(`${OUT}/pages/${page.id}.html`, cleanHtml(first.text, 90_000));
    if (page.follow) {
      const $ = cheerio.load(first.text);
      const href = $("a[href]")
        .map((_, node) => $(node).attr("href") ?? "")
        .get()
        .map((value) => {
          try {
            return new URL(value, page.url).toString();
          } catch {
            return "";
          }
        })
        .find((url) => url && page.follow?.test(new URL(url).pathname));
      if (href) {
        const detail = await attempt(sleepless, href);
        console.log(`  ${page.id} detail ${href}: ${detail.result.ok ? `HTTP ${detail.result.status}` : `FAILED ${detail.result.note}`}`);
        if (detail.text) write(`${OUT}/pages/${page.id}-detail.html`, cleanHtml(detail.text, 60_000));
      }
    }
  }
}

async function stepApis() {
  console.log("\n=== 3/5 Documented APIs and feeds ===");
  const rows: Array<Attempt & { id: string }> = [];
  for (const target of API_TARGETS) {
    const response = await attempt(sleepless, target.url, { robots: !target.documented, accept: "application/json,application/rss+xml,application/xml;q=0.9,*/*;q=0.5" });
    rows.push({ id: target.id, ...response.result });
    console.log(`${target.id}: ${response.result.ok ? `HTTP ${response.result.status} ${response.result.contentType} ${response.result.bytes} bytes` : `FAILED ${response.result.status} ${response.result.note}`}`);
    if (response.text) write(`${OUT}/api/${target.id}.txt`, response.text.slice(0, 24_000));
  }
  write(`${OUT}/apis.json`, `${JSON.stringify(rows, null, 1)}\n`);
}

async function stepDiscovery() {
  console.log(`\n=== 4/5 Source discovery (${SITES.length} candidate sites) ===`);
  const results = await pool(SITES, 6, async (candidate) => {
    const result = await probeSite(candidate);
    console.log(`${candidate.base.padEnd(46)} ${result.verdict}`);
    return result;
  });
  write(`${OUT}/discovery.json`, `${JSON.stringify(results, null, 1)}\n`);
  const lines = ["# Source discovery", "", "| group | site | robots | WP-JSON | feed | home | title / generator |", "|---|---|---|---|---|---|---|"];
  for (const r of results) {
    const robots = r.robots.allowsHome === undefined ? `HTTP ${r.robots.status}${r.robots.note ? ` (${r.robots.note.slice(0, 40)})` : ""}` : r.robots.allowsHome ? "ok" : "BLOCKS US";
    lines.push(
      `| ${r.group} | ${r.base.replace("https://", "")} | ${robots} | ${r.wpJson?.ok ? "yes" : r.wpJson ? `no (${r.wpJson.status})` : "-"} | ${r.feed?.sample ? "yes" : "no"} | ${r.home ? (r.home.ok ? r.home.status : `${r.home.status} ${r.home.note?.slice(0, 50) ?? ""}`) : r.verdict.slice(0, 60)} | ${(r.home?.title ?? "").replace(/\|/g, "/").slice(0, 70)}${r.home?.generator ? ` · ${r.home.generator}` : ""} |`,
    );
  }
  write(`${OUT}/discovery.md`, `${lines.join("\n")}\n`);
}

async function stepLinks() {
  console.log(`\n=== 5/5 Link health for the ${resources.length} directory resources ===`);
  const started = Date.now();
  const results = await checkResources(resources);
  write(`${OUT}/link-health.json`, `${JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 1)}\n`);
  const verdicts = Object.values(results).reduce<Record<string, number>>((acc, entry) => ({ ...acc, [entry.verdict]: (acc[entry.verdict] ?? 0) + 1 }), {});
  console.log(`Checked ${resources.length} links in ${((Date.now() - started) / 1000).toFixed(0)}s:`, verdicts);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  console.log(`Probe started ${new Date().toISOString()} as ${USER_AGENT}`);
  for (const [name, step] of [["scrape", stepScrape], ["pages", stepPages], ["apis", stepApis], ["discovery", stepDiscovery], ["links", stepLinks]] as const) {
    if (!STEPS.has(name)) continue;
    try {
      await step();
    } catch (error) {
      console.error(`Step ${name} failed:`, error);
      write(`${OUT}/${name}.failed.txt`, String(error instanceof Error ? error.stack : error));
    }
  }
  console.log(`Probe finished ${new Date().toISOString()}`);
}

void main();
