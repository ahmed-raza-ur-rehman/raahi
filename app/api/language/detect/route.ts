import { NextResponse } from "next/server";
import { z } from "zod";
import { detectLanguage } from "@/lib/ai/language";
const schema = z.object({ text: z.string().trim().min(1).max(1000) });
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => undefined)); if (!parsed.success) return NextResponse.json({ error: "Text is required." }, { status: 400 }); return NextResponse.json({ language: detectLanguage(parsed.data.text) }); }