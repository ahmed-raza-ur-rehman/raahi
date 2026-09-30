import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listTests } from "@/lib/knowledge";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const category = new URL(request.url).searchParams.get("category") ?? undefined;
  return NextResponse.json({ results: listTests({ ...(category ? { category } : {}) }) });
}
