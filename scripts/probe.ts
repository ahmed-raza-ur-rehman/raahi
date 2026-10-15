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
import { X509Certificate } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import https from "node:https";
import tls from "node:tls";
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
  { id: "gopunjab-jobs", url: "https://gopunjab.pk/jobs/" },
  { id: "pjb-day-2026-10-14", url: "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-14/" },
  { id: "pjb-day-2026-10-11", url: "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-11/" },
  { id: "pjb-day-2026-10-04", url: "https://www.pakistanjobsbank.com/Jobs-in-Pakistan/2026-10-04/" },
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
  const withDeadline = new Map<string, number>();
  for (const item of snapshot.items) if (item.deadline) withDeadline.set(item.sourceId, (withDeadline.get(item.sourceId) ?? 0) + 1);
  lines.push("", "Items per source in the merged snapshot (items with a deadline in brackets):", "", [...bySource].map(([id, count]) => `${id}: ${count} (${withDeadline.get(id) ?? 0})`).join(", "));
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

// ─── TLS chains: several .gov.pk servers send only their own certificate and not the intermediate ─────────────
// Browsers repair this by following the certificate's "CA Issuers" link (AIA); Node does not. This step finds the
// missing intermediate certificates, proves that adding them makes the chain verify against the normal root store
// (it never switches verification off), and keeps a trimmed copy of the home page for writing a parser.

const CERT_HOSTS = ["www.fpsc.gov.pk", "pmyp.gov.pk", "www.digiskills.pk"];

function derToPem(der: Buffer): string {
  return `-----BEGIN CERTIFICATE-----\n${der.toString("base64").match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END CERTIFICATE-----\n`;
}

interface ChainLink {
  subject: string;
  issuer: string;
  validTo: string;
  aia: string[];
}

function readChain(host: string): Promise<{ chain: ChainLink[]; authorized: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 15_000 }, () => {
      const chain: ChainLink[] = [];
      const seen = new Set<string>();
      let cert: tls.DetailedPeerCertificate | undefined = socket.getPeerCertificate(true);
      while (cert?.fingerprint256 && !seen.has(cert.fingerprint256) && chain.length < 6) {
        seen.add(cert.fingerprint256);
        const aia = cert.infoAccess?.["CA Issuers - URI"] ?? [];
        chain.push({ subject: String(cert.subject?.CN ?? cert.subject?.O ?? "?"), issuer: String(cert.issuer?.CN ?? cert.issuer?.O ?? "?"), validTo: cert.valid_to, aia: Array.isArray(aia) ? aia : [aia] });
        cert = cert.issuerCertificate;
      }
      const authorized = socket.authorized;
      const error = authorized ? undefined : String(socket.authorizationError ?? "");
      socket.end();
      resolve({ chain, authorized, error });
    });
    socket.on("error", (error) => resolve({ chain: [], authorized: false, error: error.message }));
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ chain: [], authorized: false, error: "timeout" });
    });
  });
}

async function downloadCertificate(url: string): Promise<X509Certificate | undefined> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    try {
      return new X509Certificate(bytes);
    } catch {
      return new X509Certificate(bytes.toString("utf8"));
    }
  } catch {
    return undefined;
  }
}

function tlsGet(host: string, path: string, ca: string[]): Promise<{ status: number; body: string; error?: string }> {
  return new Promise((resolve) => {
    const request = https.request({ host, path, port: 443, method: "GET", ca, servername: host, timeout: 20_000, headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.5" } }, (response) => {
      const parts: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size < 3_000_000) parts.push(chunk);
      });
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(parts).toString("utf8") }));
    });
    request.on("error", (error) => resolve({ status: 0, body: "", error: `${error.message}${(error as { code?: string }).code ? ` (${(error as { code?: string }).code})` : ""}` }));
    request.on("timeout", () => {
      request.destroy();
      resolve({ status: 0, body: "", error: "timeout" });
    });
    request.end();
  });
}

async function stepCerts() {
  console.log(`\n=== TLS chains for ${CERT_HOSTS.length} hosts ===`);
  const report: string[] = ["# TLS chain repair", ""];
  for (const host of CERT_HOSTS) {
    const outcome = await readChain(host);
    console.log(`${host}: authorized=${outcome.authorized} ${outcome.error ?? ""} chain=${outcome.chain.map((link) => `${link.subject}←${link.issuer}`).join(" | ")}`);
    report.push(`## ${host}`, "", `- verified by Node as served: ${outcome.authorized}${outcome.error ? ` (${outcome.error})` : ""}`);
    for (const link of outcome.chain) report.push(`- ${link.subject} ← issued by ${link.issuer}; valid to ${link.validTo}; AIA: ${link.aia.join(", ") || "none"}`);
    if (outcome.authorized || outcome.chain.length === 0) {
      report.push("");
      continue;
    }

    // Follow the "CA Issuers" links until the chain verifies against the normal root store.
    const found: X509Certificate[] = [];
    let queue = outcome.chain.flatMap((link) => link.aia);
    for (let round = 0; round < 4 && queue.length > 0; round += 1) {
      const next: string[] = [];
      for (const url of [...new Set(queue)]) {
        const certificate = await downloadCertificate(url);
        report.push(`- downloaded ${url}: ${certificate ? `${certificate.subject.replace(/\n/g, ", ")} (valid to ${certificate.validTo})` : "failed"}`);
        if (!certificate) continue;
        found.push(certificate);
        const aia = /CA Issuers - URI:(\S+)/.exec(certificate.infoAccess ?? "")?.[1];
        if (aia) next.push(aia);
      }
      queue = next;
    }
    const pem = found.map((certificate) => derToPem(certificate.raw)).join("");
    const trial = await tlsGet(host, "/robots.txt", [...tls.rootCertificates, ...found.map((certificate) => certificate.toString())]);
    const works = trial.status > 0;
    console.log(`  ${found.length} intermediate certificate(s) found; verifies with them: ${works} (robots.txt HTTP ${trial.status}${trial.error ? ` ${trial.error}` : ""})`);
    report.push(`- ${found.length} intermediate certificate(s) found; chain verifies once they are added: **${works}** (robots.txt HTTP ${trial.status}${trial.error ? `, ${trial.error}` : ""})`);
    if (found.length > 0) write(`${OUT}/certs/${slug(host)}.pem`, pem);
    if (!works) {
      report.push("");
      continue;
    }

    const ca = [...tls.rootCertificates, ...found.map((certificate) => certificate.toString())];
    const rules = trial.status === 200 ? parseRobots(trial.body.slice(0, 512 * 1024)) : undefined;
    const allowed = (path: string) => (rules ? isAllowed(rules, ROBOTS_TOKEN, path) : true);
    report.push(`- robots.txt allows the home page: ${allowed("/")}`);
    if (!allowed("/")) {
      report.push("");
      continue;
    }
    const home = await tlsGet(host, "/", ca);
    report.push(`- home page: HTTP ${home.status}, ${home.body.length} bytes${home.error ? `, ${home.error}` : ""}`);
    if (home.body) {
      write(`${OUT}/html/${slug(host)}.html`, cleanHtml(home.body, 80_000));
      const $ = cheerio.load(home.body);
      const links = $("a[href]")
        .map((_, node) => ({ text: $(node).text().replace(/\s+/g, " ").trim(), href: $(node).attr("href") ?? "" }))
        .get()
        .filter((link) => /job|advert|vacanc|career|recruit|scholar|enrol|batch/i.test(`${link.text} ${link.href}`))
        .slice(0, 12);
      for (const link of links) report.push(`  - "${link.text.slice(0, 80)}" → ${link.href.slice(0, 120)}`);
      // One level deeper: the most promising listing page, again only if robots.txt allows it.
      const listing = links.find((link) => /jobs?|advert|vacanc/i.test(link.href) && !/^(https?:)?\/\//i.test(link.href) && !/\.(pdf|docx?|jpg|png)$/i.test(link.href));
      if (listing) {
        const path = listing.href.startsWith("/") ? listing.href : `/${listing.href}`;
        if (allowed(path)) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const page = await tlsGet(host, path, ca);
          report.push(`- listing ${path}: HTTP ${page.status}, ${page.body.length} bytes`);
          if (page.body) write(`${OUT}/pages/${slug(host)}-listing.html`, cleanHtml(page.body, 90_000));
        }
      }
    }
    report.push("");
  }
  write(`${OUT}/certs.md`, `${report.join("\n")}\n`);
}

// ─── Raw captures: sites whose list is drawn by JavaScript. Keeps the untrimmed HTML (including the data the server
// embeds for the page) and finds the endpoints the page's own scripts call, so a parser can read the same public data.

async function stepRaw() {
  console.log("\n=== Raw captures ===");
  const report: string[] = ["# Raw captures", ""];
  const fpscCa = [...tls.rootCertificates, readFileSync(".probe/r5/certs/www-fpsc-gov-pk.pem", "utf8")];
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  for (const [id, path] of [["fpsc-jobs-gr", "/Jobs?section=GR"], ["fpsc-jobs-css", "/Jobs?section=CSS"]] as const) {
    const page = await tlsGet("www.fpsc.gov.pk", path, fpscCa);
    console.log(`${id}: HTTP ${page.status}, ${page.body.length} bytes ${page.error ?? ""}`);
    report.push(`## ${id}: HTTP ${page.status}, ${page.body.length} bytes${page.error ? `, ${page.error}` : ""}`);
    if (!page.body) continue;
    write(`${OUT}/raw/${id}.html`, page.body.slice(0, 260_000));
    const scripts = [...page.body.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => match[1]);
    const payloads = [...page.body.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((match) => match[1]);
    report.push(`- ${scripts.length} script tags, ${payloads.length} embedded data chunks (${payloads.reduce((total, chunk) => total + chunk.length, 0)} characters)`);
    for (const src of scripts.filter((value) => /\/_next\/static\/chunks\//.test(value)).slice(0, 16)) {
      await pause(700);
      const script = await tlsGet("www.fpsc.gov.pk", src.replace(/^https?:\/\/[^/]+/, ""), fpscCa);
      if (!script.body) continue;
      const calls = [...script.body.matchAll(/["'`](\/?api\/[A-Za-z0-9_\-/.]+(?:\?[^"'`]*)?)["'`]|fetch\(\s*["'`]([^"'`]+)["'`]/g)].map((match) => match[1] ?? match[2]).slice(0, 8);
      const about = /section=|Jobs|advertis/i.test(script.body);
      if (calls.length > 0 || about) {
        report.push(`- ${src.slice(-70)}: ${script.body.length} bytes; calls: ${calls.join(", ") || "none"}; mentions jobs/advertisements: ${about}`);
        if (about && script.body.length < 220_000) write(`${OUT}/raw/${slug(src)}.js`, script.body.slice(0, 160_000));
      }
    }
    report.push("");
  }

  for (const target of [
    { host: "apply.kppsc.gov.pk", path: "/", id: "kppsc-apply" },
    { host: "internpools.com", path: "/", id: "internpools" },
  ]) {
    await pause(1200);
    const robots = await tlsGet(target.host, "/robots.txt", [...tls.rootCertificates]);
    const allowed = robots.status === 200 ? isAllowed(parseRobots(robots.body.slice(0, 512 * 1024)), ROBOTS_TOKEN, target.path) : true;
    const page = allowed ? await tlsGet(target.host, target.path, [...tls.rootCertificates]) : { status: 0, body: "", error: "robots.txt disallows" };
    console.log(`${target.id}: robots HTTP ${robots.status}, page HTTP ${page.status}, ${page.body.length} bytes ${page.error ?? ""}`);
    report.push(`## ${target.id}: robots HTTP ${robots.status}; page HTTP ${page.status}, ${page.body.length} bytes${page.error ? `, ${page.error}` : ""}`, "");
    if (page.body) write(`${OUT}/raw/${target.id}.html`, cleanHtml(page.body, 90_000));
  }
  write(`${OUT}/raw.md`, `${report.join("\n")}\n`);
}

// ─── Data endpoints behind JavaScript-drawn lists (FPSC, PTS) and the wording of DigiSkills enrolment news ──────

async function stepApi2() {
  console.log("\n=== Data endpoints ===");
  const report: string[] = ["# Data endpoints", ""];
  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
  const roots = [...tls.rootCertificates];
  const fpscCa = [...roots, readFileSync(".probe/r5/certs/www-fpsc-gov-pk.pem", "utf8")];
  const digiCa = [...roots, readFileSync(".probe/r5/certs/www-digiskills-pk.pem", "utf8")];

  for (const [id, path] of [["fpsc-api-jobs", "/api/jobs"], ["fpsc-api-jobs-all", "/api/jobs?includeExpired=true"]] as const) {
    const response = await tlsGet("www.fpsc.gov.pk", path, fpscCa);
    console.log(`${id}: HTTP ${response.status}, ${response.body.length} bytes ${response.error ?? ""}`);
    report.push(`## ${id}: HTTP ${response.status}, ${response.body.length} bytes${response.error ? `, ${response.error}` : ""}`, "");
    if (response.body) write(`${OUT}/raw/${id}.json`, response.body.slice(0, 180_000));
    await pause(1200);
  }

  // PTS draws its list with AngularJS: find the endpoints its own scripts call.
  const pts = await tlsGet("www.pts.org.pk", "/Projects/", roots);
  report.push(`## PTS projects page: HTTP ${pts.status}, ${pts.body.length} bytes${pts.error ? `, ${pts.error}` : ""}`);
  if (pts.body) {
    write(`${OUT}/raw/pts-projects-raw.html`, pts.body.slice(0, 120_000));
    const bodies: string[] = [...pts.body.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    const sources = [...pts.body.matchAll(/<script[^>]+src="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((src) => !/googletagmanager|googlesyndication|jquery|bootstrap|angular(\.min)?\.js|cdnjs|gstatic|cloudflare|analytics/i.test(src));
    for (const src of sources.slice(0, 8)) {
      const url = new URL(src, "https://www.pts.org.pk/");
      if (!/(^|\.)pts\.org\.pk$/.test(url.host)) continue;
      await pause(800);
      const script = await tlsGet(url.host, `${url.pathname}${url.search}`, roots);
      if (script.body) {
        bodies.push(script.body);
        report.push(`- script ${url.pathname}: ${script.body.length} bytes`);
      }
    }
    const endpoints = new Set<string>();
    for (const body of bodies) {
      for (const match of body.matchAll(/\$http(?:\.get|\.post)?\(\s*(?:\{[^}]*url\s*:\s*)?['"`]([^'"`]+)['"`]|url\s*:\s*['"`](\/[^'"`]+)['"`]/g)) endpoints.add(match[1] ?? match[2]);
    }
    report.push(`- endpoints found: ${[...endpoints].join(", ") || "none"}`);
    write(`${OUT}/raw/pts-scripts.txt`, bodies.join("\n\n/* ---- next script ---- */\n\n").slice(0, 200_000));
    for (const endpoint of [...endpoints].filter((value) => value.startsWith("/") && !/save|login|submit|delete|update|insert/i.test(value)).slice(0, 4)) {
      await pause(1200);
      const response = await tlsGet("www.pts.org.pk", endpoint, roots);
      report.push(`- GET ${endpoint}: HTTP ${response.status}, ${response.body.length} bytes`);
      if (response.body) write(`${OUT}/raw/pts-${slug(endpoint)}.txt`, response.body.slice(0, 80_000));
    }
  }
  report.push("");

  // DigiSkills: how enrolment announcements are worded (only the visible text is kept).
  const digi: string[] = [];
  for (const id of [268, 267, 266, 265, 264, 263, 262, 261, 260]) {
    await pause(1200);
    const page = await tlsGet("www.digiskills.pk", `/NewsDetails.aspx?NewsId=${id}`, digiCa);
    if (!page.body) {
      digi.push(`### NewsId=${id}: HTTP ${page.status} ${page.error ?? ""}`);
      continue;
    }
    const $ = cheerio.load(page.body);
    $("script, style, nav, header, footer").remove();
    const text = $("body").text().replace(/\s+/g, " ").trim();
    const at = text.search(/enrol|batch|commence/i);
    digi.push(`### NewsId=${id}: ${$("title").text().trim().slice(0, 80)}\n${text.slice(Math.max(0, at - 80), Math.max(0, at - 80) + 700)}`);
  }
  write(`${OUT}/raw/digiskills-news.txt`, digi.join("\n\n"));
  report.push(`## DigiSkills news: ${digi.length} pages kept`, "");
  write(`${OUT}/api2.md`, `${report.join("\n")}\n`);
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
  for (const [name, step] of [["scrape", stepScrape], ["certs", stepCerts], ["raw", stepRaw], ["api2", stepApi2], ["pages", stepPages], ["apis", stepApis], ["discovery", stepDiscovery], ["links", stepLinks]] as const) {
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
