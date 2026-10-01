import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getEntity } from "@/lib/knowledge";
import { recommendDocuments } from "@/lib/ai/recommend";
import type { Language, OpportunityRecord } from "@/lib/types";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const { id } = await context.params;
  const record = getEntity<OpportunityRecord>(id);
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const language = (new URL(request.url).searchParams.get("language") ?? "ur") as Language;
  return NextResponse.json({
    record,
    documents: recommendDocuments(record, {}, language),
  });
}
