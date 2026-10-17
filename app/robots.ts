import type { MetadataRoute } from "next";
import { originOrLocal } from "@/lib/opportunities/site";

export default function robots(): MetadataRoute.Robots {
  const origin = originOrLocal();
  return {
    rules: [{ userAgent: "*", allow: ["/", "/embed/"], disallow: ["/api/", "/cases", "/portal"] }],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
