import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        // Everything public is indexable: this is public-service information
        // and people search for it. (Our own *scraper* obeys robots.txt
        // elsewhere — that is a separate responsibility.)
        allow: "/",
        // APIs and personal pages must never be crawled or indexed.
        disallow: ["/api/", "/track", "/cases", "/chat", "/portal"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
