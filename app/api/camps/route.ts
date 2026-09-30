import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listCamps } from "@/lib/knowledge";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const province = new URL(request.url).searchParams.get("province") ?? undefined;
  return NextResponse.json({ results: listCamps(province) });
}
