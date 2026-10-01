import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { unifiedSearch, discoverOfficialUpdates, inspectPage, liveSearchStatus } from "@/lib/web/search";
import { hostStatus } from "@/lib/web/scraper";
import { buildOfficialQuery, officialSourcesFor } from "@/lib/web/dorking";

const schema = z.object({
  query: z.string().trim().min(2).max(300),
  mode: z.enum(["search", "discover", "inspect"]).default("search"),
  live: z.boolean().optional(),
  limit: z.number().int().min(1).max(10).optional(),
  url: z.string().url().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "A search term is required." }, { status: 400 });

  ensureDatabaseSeeded();
  const { query, mode, live, limit, url } = parsed.data;

  if (mode === "inspect") {
    if (!url) return NextResponse.json({ error: "A page URL is required." }, { status: 400 });
    const page = await inspectPage(url);
    return NextResponse.json({ page, rateLimit: hostStatus(page.host) });
  }

  if (mode === "discover") {
    const discovered = await discoverOfficialUpdates(query);
    return NextResponse.json({ ...discovered, status: liveSearchStatus() });
  }

  const results = await unifiedSearch(query, { ...(live !== undefined ? { live } : {}), ...(limit ? { limit } : {}), topic: query });
  return NextResponse.json({
    ...results,
    operators: {
      notification: buildOfficialQuery("notification", query, officialSourcesFor(query).map((entry) => entry.domain)),
      dates: buildOfficialQuery("dates", query, officialSourcesFor(query).map((entry) => entry.domain)),
    },
  });
}

export async function GET() {
  ensureDatabaseSeeded();
  return NextResponse.json({ status: liveSearchStatus() });
}
