import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listScholarships } from "@/lib/knowledge";
import { pick } from "@/lib/i18n";
import type { Language } from "@/lib/types";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");
  const level = url.searchParams.get("level") ?? undefined;
  const language = (url.searchParams.get("language") ?? "ur") as Language;
  const query = url.searchParams.get("q")?.toLowerCase();

  let items = listScholarships({
    ...(scope === "national" || scope === "international" ? { scope } : {}),
    ...(level ? { level } : {}),
  });

  if (query) {
    items = items.filter((item) =>
      [pick(item.title, "en"), pick(item.title, language), item.provider, item.tags.join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }

  return NextResponse.json({
    results: items,
    count: items.length,
    scope: {
      national: items.filter((item) => item.scope === "national").length,
      international: items.filter((item) => item.scope === "international").length,
    },
  });
}
