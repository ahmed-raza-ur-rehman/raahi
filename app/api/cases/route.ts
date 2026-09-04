import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { createCase, listCases } from "@/lib/db/repositories/cases";
import { getSessionId } from "@/lib/web/session";

const schema = z.object({ title: z.string().min(1).max(160), titleUr: z.string().min(1).max(160), domain: z.enum(["welfare", "education", "health", "documentation", "disaster", "legal", "employment"]), summary: z.string().min(1).max(2000), serviceIds: z.array(z.string()).max(20), actions: z.array(z.object({ label: z.string().min(1), labelUr: z.string().min(1), serviceId: z.string().optional() })).max(30) });
export async function GET() { ensureDatabaseSeeded(); return NextResponse.json({ results: listCases(await getSessionId()) }); }
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => undefined)); if (!parsed.success) return NextResponse.json({ error: "A complete case is required." }, { status: 400 }); ensureDatabaseSeeded(); return NextResponse.json({ case: createCase({ ...parsed.data, sessionId: await getSessionId() }) }, { status: 201 }); }