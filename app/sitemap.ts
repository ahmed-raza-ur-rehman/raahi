import type { MetadataRoute } from "next";
import { listGuides } from "@/lib/opportunities/guides";
import { originOrLocal } from "@/lib/opportunities/site";
import { prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";

// The listings change every few hours, so the sitemap is built per request, never at build time.
export const dynamic = "force-dynamic";

const STATIC_PAGES: Array<{ path: string; priority: number; changeFrequency: "hourly" | "daily" | "weekly" | "monthly" }> = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/opportunities", priority: 0.9, changeFrequency: "hourly" },
  { path: "/opportunities/calendar", priority: 0.8, changeFrequency: "daily" },
  { path: "/opportunities/guides", priority: 0.8, changeFrequency: "monthly" },
  { path: "/opportunities/resources", priority: 0.7, changeFrequency: "weekly" },
  { path: "/opportunities/tools", priority: 0.6, changeFrequency: "monthly" },
  { path: "/programs", priority: 0.6, changeFrequency: "weekly" },
];

const MAX_LISTINGS = 500;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = originOrLocal();
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({ url: `${origin}${page.path}`, changeFrequency: page.changeFrequency, priority: page.priority }));

  for (const guide of listGuides()) {
    entries.push({ url: `${origin}/opportunities/guides/${guide.id}`, lastModified: guide.reviewed, changeFrequency: "monthly", priority: 0.6 });
  }

  await prepareOpportunities();
  for (let offset = 0; offset < MAX_LISTINGS; offset += 100) {
    const page = searchOpportunities({ limit: 100, offset, sort: "newest" });
    for (const item of page.items) {
      if (item.kind === "coupon") continue; // coupons expire within days; not worth indexing
      entries.push({ url: `${origin}/opportunities/${item.id}`, lastModified: item.lastSeen, changeFrequency: "daily", priority: 0.5 });
    }
    if (page.items.length < 100) break;
  }
  return entries;
}
