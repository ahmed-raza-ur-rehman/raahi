import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { searchServicesHybrid } from "@/lib/rag/search";

const schema = z.object({ query: z.string().trim().min(2).max(1000), domain: z.string().optional(), province: z.string().optional(), limit: z.number().int().min(1).max(10).optional() });
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "A search query is required." }, { status: 400 });
  ensureDatabaseSeeded();
  return NextResponse.json({ results: await searchServicesHybrid(parsed.data as Parameters<typeof searchServicesHybrid>[0]) });
}