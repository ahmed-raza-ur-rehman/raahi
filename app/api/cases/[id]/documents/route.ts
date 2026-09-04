import { NextResponse } from "next/server";
import { z } from "zod";
import { addDocument } from "@/lib/db/repositories/cases";
import { getSessionId } from "@/lib/web/session";
const schema = z.object({ documentType: z.string().min(1).max(80), label: z.string().min(1).max(160), ocrData: z.record(z.string(), z.string()).optional() });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) { const parsed = schema.safeParse(await request.json().catch(() => undefined)); if (!parsed.success) return NextResponse.json({ error: "Document details are required." }, { status: 400 }); const document = addDocument({ ...(await params), ...(parsed.data), sessionId: await getSessionId(), caseId: (await params).id }); return document ? NextResponse.json({ document }, { status: 201 }) : NextResponse.json({ error: "Case not found." }, { status: 404 }); }