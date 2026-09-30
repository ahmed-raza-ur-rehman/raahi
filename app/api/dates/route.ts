import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { importantDates } from "@/lib/knowledge";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const category = new URL(request.url).searchParams.get("category") ?? undefined;
  return NextResponse.json({ results: importantDates(category), count: importantDates(category).length });
}
