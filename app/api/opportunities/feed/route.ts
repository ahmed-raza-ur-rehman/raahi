import { CORS_HEADERS, errorResponse, optionsResponse, parseOpportunityQuery } from "@/lib/opportunities/api";
import { FEED_CONTENT_TYPE, buildAtom, buildJsonFeed, buildRss, describeQuery, siteOrigin, type FeedFormat } from "@/lib/opportunities/feeds";
import { getStatus, prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";

/**
 * GET /api/opportunities/feed?format=rss|atom|json&… — subscribe to any search in a feed reader.
 * Takes the same filters as /api/opportunities (q, kind, scope, country, level, funding, within, remote, pk …).
 * Newest first, 30 entries by default (max 100). Open to Pakistan unless `pk=0`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const requested = (url.searchParams.get("format") ?? "rss").toLowerCase();
  if (requested !== "rss" && requested !== "atom" && requested !== "json") return errorResponse("format must be rss, atom or json", 400);
  const format: FeedFormat = requested;

  const parsed = parseOpportunityQuery(url.searchParams);
  await prepareOpportunities();
  const query = { ...parsed, openToPakistan: parsed.openToPakistan ?? true, sort: parsed.sort ?? ("newest" as const), limit: Math.min(parsed.limit ?? 30, 100), offset: 0 };
  const result = searchOpportunities(query);
  const status = getStatus();

  const origin = siteOrigin(request);
  const home = new URLSearchParams(url.searchParams);
  home.delete("format");
  home.delete("limit");
  const meta = {
    title: `RAAHI — ${describeQuery(query)}`,
    description: "Fresh scholarships, jobs, internships, admissions, competitions and courses for Pakistan and abroad, from official portals and trusted sites. Always confirm details on the official page.",
    origin,
    homeUrl: `${origin}/opportunities${home.toString() ? `?${home.toString()}` : ""}`,
    selfUrl: `${origin}${url.pathname}${url.search}`,
    updated: status.generatedAt ? new Date(status.generatedAt) : new Date(),
  };

  const body = format === "rss" ? buildRss(result.items, meta) : format === "atom" ? buildAtom(result.items, meta) : JSON.stringify(buildJsonFeed(result.items, meta), null, 2);
  return new Response(body, {
    headers: { ...CORS_HEADERS, "Content-Type": FEED_CONTENT_TYPE[format], "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800" },
  });
}

export function OPTIONS() {
  return optionsResponse();
}
