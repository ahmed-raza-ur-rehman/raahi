import { resources } from "@/data/opportunities/resources";
import linkHealth from "@/data/opportunities/link-health.json";
import { interpretQuery } from "./query";
import { RESOURCE_CATEGORIES, type FacetCount, type LinkHealthEntry, type OpportunityKind, type Resource, type ResourceCategory } from "./types";

export interface DirectoryQuery {
  q?: string;
  category?: ResourceCategory;
  scope?: "pakistan" | "international";
  free?: boolean;
  /** Only official/institutional sources (authority 1–2). */
  official?: boolean;
  tag?: string;
  /** Only entries a person or tool actually confirmed (have a `checked` date). */
  verified?: boolean;
}

export interface DirectoryItem extends Resource {
  health?: LinkHealthEntry;
}

const KIND_CATEGORIES: Partial<Record<OpportunityKind, ResourceCategory[]>> = {
  scholarship: ["scholarships", "scholarships-pk"],
  fellowship: ["scholarships", "research"],
  internship: ["internships"],
  job: ["jobs-pk", "jobs-global", "govt-recruitment", "overseas-employment"],
  competition: ["competitions"],
  course: ["learning", "skills-pk"],
  coupon: ["coupons", "learning"],
  training: ["learning", "skills-pk"],
  grant: ["grants"],
  notice: ["safety", "overseas-employment"],
};

const health = (linkHealth as { results: Record<string, LinkHealthEntry> }).results ?? {};

export function linkHealthCheckedAt(): string | null {
  return (linkHealth as { checkedAt: string | null }).checkedAt;
}

export function searchResources(query: DirectoryQuery = {}): { total: number; items: DirectoryItem[]; categories: FacetCount[] } {
  const parsed = interpretQuery(query.q ?? "");
  const wantedCategories = new Set<ResourceCategory>(query.category ? [query.category] : (parsed.kinds ?? []).flatMap((kind) => KIND_CATEGORIES[kind] ?? []));
  const scope = query.scope ?? parsed.scope;
  const terms = parsed.terms.map((term) => term.toLowerCase());
  const tag = query.tag?.toLowerCase();

  const scored: Array<{ item: DirectoryItem; score: number }> = [];
  for (const resource of resources) {
    if (query.free && !resource.free) continue;
    if (query.official && resource.authority > 2) continue;
    if (query.verified && !resource.checked) continue;
    if (tag && !resource.tags.includes(tag)) continue;
    if (scope && resource.scope !== "both" && resource.scope !== scope) continue;
    if (wantedCategories.size > 0 && !wantedCategories.has(resource.category)) continue;

    let score = 0;
    if (terms.length > 0) {
      const haystackName = `${resource.name} ${resource.nameUr ?? ""}`.toLowerCase();
      const haystackTags = resource.tags.join(" ");
      const haystackText = `${resource.description} ${resource.descriptionUr ?? ""} ${resource.note ?? ""}`.toLowerCase();
      let matched = 0;
      for (const term of terms) {
        const inName = haystackName.includes(term);
        const inTags = haystackTags.includes(term);
        const inText = haystackText.includes(term);
        if (inName || inTags || inText) matched += 1;
        score += (inName ? 5 : 0) + (inTags ? 3 : 0) + (inText ? 1 : 0);
      }
      if (matched < Math.ceil(terms.length / 2) || matched === 0) continue;
    }
    // Official, verified and Pakistan-relevant entries first.
    score += (5 - resource.authority) * 0.4 + (resource.checked ? 0.5 : 0) + (resource.scope === "pakistan" ? 0.3 : 0);
    scored.push({ item: { ...resource, health: health[resource.id] }, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name));

  const counts = new Map<string, number>();
  for (const { item } of scored) counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
  const categories = RESOURCE_CATEGORIES.filter((category) => counts.has(category)).map((category) => ({ value: category, count: counts.get(category) as number }));
  return { total: scored.length, items: scored.map((entry) => entry.item), categories };
}
