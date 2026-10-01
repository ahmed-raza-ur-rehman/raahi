import type { MetadataRoute } from "next";

import { isPathEnabled } from "@/lib/modules/config";
import { PUBLIC_ROUTES, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  // A module that is switched off is not advertised to search engines either:
  // there is nothing to gain from sending someone to a page that 404s.
  return PUBLIC_ROUTES.filter((route) => isPathEnabled(route.path)).map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
