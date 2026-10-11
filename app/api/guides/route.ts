import { jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { CATEGORY_TITLES, GUIDE_CATEGORIES, listGuides, searchGuides, summarizeGuide, type GuideCategory } from "@/lib/opportunities/guides";
import type { Language } from "@/lib/types";

/**
 * GET /api/guides?q=&category=&lang=en|ur|ps&limit= — step-by-step guides (summaries; fetch one by id for the steps).
 * `q` understands English, Roman Urdu and Urdu ("fsc ke baad kya karein", "apostille", "جعلی ویزا").
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const lang = params.get("lang");
  const language: Language = lang === "ur" || lang === "ps" ? lang : "en";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 50);
  const items = searchGuides({
    q: params.get("q")?.slice(0, 200) || undefined,
    category: category && (GUIDE_CATEGORIES as readonly string[]).includes(category) ? (category as GuideCategory) : undefined,
    limit,
  });
  const all = listGuides();
  return jsonResponse(
    {
      total: items.length,
      items: items.map((guide) => summarizeGuide(guide, language)),
      categories: GUIDE_CATEGORIES.map((id) => ({ id, label: CATEGORY_TITLES[id][language === "ps" ? "ur" : language], count: all.filter((guide) => guide.category === id).length })),
    },
    { cache: true },
  );
}

export function OPTIONS() {
  return optionsResponse();
}
