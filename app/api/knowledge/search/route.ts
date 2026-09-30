import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { searchKnowledge } from "@/lib/knowledge";
import type { KnowledgeEntityType } from "@/lib/types";

const schema = z.object({
  query: z.string().trim().min(1).max(500),
  types: z.array(z.string()).optional(),
  province: z.string().optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

const ENTITY_TYPES: KnowledgeEntityType[] = [
  "service",
  "opportunity",
  "document",
  "test",
  "camp",
  "disease",
  "medical_procedure",
  "blood_bank",
  "disaster_channel",
  "disaster_guide",
  "legal_topic",
  "contact",
];

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: "A search term is required." }, { status: 400 });
  }

  ensureDatabaseSeeded();
  const { query, types, province, category, limit } = parsed.data;
  const filteredTypes = types?.filter((type): type is KnowledgeEntityType =>
    ENTITY_TYPES.includes(type as KnowledgeEntityType),
  );

  return NextResponse.json({
    results: searchKnowledge({ query, ...(filteredTypes ? { types: filteredTypes } : {}), province, category, limit }),
  });
}
