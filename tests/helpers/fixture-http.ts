import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HttpError, type HttpClient } from "@/lib/opportunities/scrapers/http";

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
  };
}
