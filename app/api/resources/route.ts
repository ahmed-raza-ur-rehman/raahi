import { jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { linkHealthCheckedAt, searchResources } from "@/lib/opportunities/directory";
import { RESOURCE_CATEGORIES, type ResourceCategory } from "@/lib/opportunities/types";

/** GET /api/resources?q=&category=&scope=&free=1&official=1&verified=1&tag= — the curated directory. */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const scope = params.get("scope");
  const truthy = (name: string) => ["1", "true", "yes"].includes((params.get(name) ?? "").toLowerCase());
  const result = searchResources({
    q: params.get("q")?.slice(0, 200) || undefined,
    category: category && (RESOURCE_CATEGORIES as readonly string[]).includes(category) ? (category as ResourceCategory) : undefined,
    scope: scope === "pakistan" || scope === "international" ? scope : undefined,
    free: truthy("free") || undefined,
    official: truthy("official") || undefined,
    verified: truthy("verified") || undefined,
    tag: params.get("tag")?.slice(0, 40) || undefined,
  });
  return jsonResponse({ ...result, linkHealthCheckedAt: linkHealthCheckedAt() }, { cache: true });
}

export function OPTIONS() {
  return optionsResponse();
}
