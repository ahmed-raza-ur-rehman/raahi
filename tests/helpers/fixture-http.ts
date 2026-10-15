import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpError, type HttpClient } from "@/lib/opportunities/scrapers/http";
import { SOURCES } from "@/lib/opportunities/scrapers/sources";
import type { SourceDefinition } from "@/lib/opportunities/scrapers/types";

const FIXTURES = join(process.cwd(), "tests", "fixtures", "opportunities");

export function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf8");
}

type Route = string | ((url: string) => string);

/**
 * An HttpClient that serves recorded fixtures. Exact URL matches win, then the longest matching
 * prefix; anything else is a 404 so that tests notice unexpected requests.
 */
export function createFixtureHttp(routes: Record<string, Route>, requested: string[] = []): HttpClient {
  const resolve = (url: string): string => {
    requested.push(url);
    const exact = routes[url];
    const key = exact !== undefined ? url : Object.keys(routes).filter((prefix) => url.startsWith(prefix)).sort((a, b) => b.length - a.length)[0];
    if (key === undefined) throw new HttpError(404, url);
    const route = routes[key];
    return typeof route === "function" ? route(url) : route;
  };
  return {
    getText: async (url) => ({ status: 200, url, text: resolve(url), contentType: "text/plain" }),
    getJson: async <T>(url: string) => JSON.parse(resolve(url)) as T,
  };
}

/** Routes covering every registered source, so the whole pipeline can run offline. */
export function allSourceRoutes(): Record<string, Route> {
  const empty = "<html><body></body></html>";
  return {
    "https://njp.gov.pk/jobs/live": fixture("njp-live.html"),
    "https://njp.gov.pk/jobs/live?page=2": empty,
    "https://beoe.gov.pk/news-updates": fixture("beoe-news.html"),
    "https://beoe.gov.pk/": fixture("beoe-news.html"),
    "https://www.scholarshiptab.com/": fixture("scholarshiptab.html"),
    "https://www.scholars4dev.com/wp-json/wp/v2/posts": fixture("wp-scholars4dev.json"),
    "https://www.scholars4dev.com/wp-json/wp/v2/categories": fixture("wp-categories.json"),
    "https://opportunitydesk.org/wp-json/wp/v2/posts": fixture("wp-opportunitydesk.json"),
    "https://opportunitydesk.org/wp-json/wp/v2/categories": fixture("wp-categories-od.json"),
    "https://remotive.com/api/remote-jobs": fixture("remotive.json"),
    "https://jobicy.com/api/v2/remote-jobs": fixture("jobicy.json"),
    "https://www.arbeitnow.com/api/job-board-api": fixture("arbeitnow.json"),
    "https://devpost.com/api/hackathons": (url) => (new URL(url).searchParams.get("page") === "1" ? fixture("devpost.json") : '{"hackathons":[]}'),
    "https://codeforces.com/api/contest.list": fixture("codeforces.json"),
    "https://cdn.real.discount/api/courses": fixture("real-discount.json"),
    // Excerpts of the real pages and responses captured from GitHub's runners on 2026-10-11 (see fixtures/README.md).
    "https://spsc.gos.pk/advertisement.php": fixture("spsc.sample.html"),
    "https://bpsc.gob.pk/BPSC/pages?jobs": fixture("bpsc.sample.html"),
    "https://www.etea.edu.pk/": fixture("etea.sample.html"),
    "https://www.fpsc.gov.pk/api/jobs": fixture("fpsc-jobs.active.json"),
    "https://www.pts.org.pk/Projects/getProjects/": fixture("pts-projects.sample.json"),
    "https://www.pakistanjobsbank.com/": fixture("pakistanjobsbank.sample.html"),
    "https://gopunjab.pk/jobs/": fixture("gopunjab.sample.html"),
    "https://himalayas.app/jobs/api": (url) => {
      const params = new URL(url).searchParams;
      const page = params.get("page");
      return params.has("cursor") || (page && page !== "1") ? '{"jobs":[]}' : himalayasWithOpenJobs();
    },
    "https://remoteok.com/api": fixture("remoteok.sample.json"),
    "https://www.workingnomads.com/api/exposed_jobs/": fixture("workingnomads.sample.json"),
    "https://weworkremotely.com/remote-jobs.rss": fixture("weworkremotely.sample.xml"),
    "https://ctftime.org/api/v1/events/": fixture("ctftime.sample.json"),
    "https://ntslogin.pk/wp-json/wp/v2/posts": fixture("wp-ntslogin.json"),
    "https://schoolsti.org.pk/wp-json/wp/v2/posts": fixture("wp-schoolsti.json"),
    "https://www.mauqapakistan.com/feeds/posts/default": fixture("atom-mauqapakistan.xml"),
  };
}

/**
 * The registry as it would behave on a network where every site answers: sources switched off only because they
 * block GitHub's servers are enabled, so their parsers keep being exercised against fixtures. Pair it with
 * `region: "pk"` in `runScrapers` to include the sources that need a Pakistani connection.
 */
export function fixtureSources(): SourceDefinition[] {
  return SOURCES.map((source) => (source.disabledReason ? { ...source, enabled: true } : source));
}

/**
 * The real Himalayas sample has three location-restricted jobs (Brazil, United States, United States), all of which
 * the adapter rightly drops. For pipeline tests, two of them are re-labelled as worldwide / Pakistan-eligible; every
 * other field is the real response.
 */
export function himalayasWithOpenJobs(): string {
  const sample = JSON.parse(fixture("himalayas.sample.json")) as { jobs: Array<{ locationRestrictions: string[] }> };
  sample.jobs[1].locationRestrictions = [];
  sample.jobs[2].locationRestrictions = ["Pakistan", "India"];
  return JSON.stringify(sample);
}
