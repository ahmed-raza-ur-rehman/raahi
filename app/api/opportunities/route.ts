import { guardLegacy } from "@/lib/platform/legacy";
import { jsonResponse, optionsResponse, parseOpportunityQuery } from "@/lib/opportunities/api";
import { getStatus, prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";

/** GET /api/opportunities?q=&kind=&scope=&country=&level=&funding=&pk=1&remote=1&within=14&new=3&sort=&limit=&offset= */
async function handleGET(request: Request) {
  await prepareOpportunities();
  const query = parseOpportunityQuery(new URL(request.url).searchParams);
  const result = searchOpportunities(query);
  return jsonResponse({ ...result, generatedAt: getStatus().generatedAt }, { cache: true });
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy(handleGET, { name: "listOpportunitiesLegacy", csrf: false, limits: [{ policy: "search", by: "ip" }] });
