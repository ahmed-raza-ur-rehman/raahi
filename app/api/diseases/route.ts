import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listDiseaseSignals } from "@/lib/knowledge";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const severity = new URL(request.url).searchParams.get("severity") ?? undefined;
  return NextResponse.json({
    results: listDiseaseSignals(severity),
    note: "RAAHI does not diagnose. These signs help a community notice a problem early and report it.",
  });
}
