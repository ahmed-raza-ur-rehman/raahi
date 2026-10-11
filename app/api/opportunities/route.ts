import { jsonResponse, optionsResponse, parseOpportunityQuery } from "@/lib/opportunities/api";
import { getStatus, prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";

/** GET /api/opportunities?q=&kind=&scope=&country=&level=&funding=&pk=1&remote=1&within=14&new=3&sort=&limit=&offset= */
export async function GET(request: Request) {
  await prepareOpportunities();
  const query = parseOpportunityQuery(new URL(request.url).searchParams);
  const result = searchOpportunities(query);
  return jsonResponse({ ...result, generatedAt: getStatus().generatedAt }, { cache: true });
}

export function OPTIONS() {
  return optionsResponse();
}
