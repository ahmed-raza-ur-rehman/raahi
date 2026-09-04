import { NextResponse } from "next/server";
import { z } from "zod";
import { processDocument } from "@/lib/ai/ocr";
const schema = z.object({ imageBase64: z.string().min(20).max(8_000_000) });
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => undefined)); if (!parsed.success) return NextResponse.json({ error: "A document image is required." }, { status: 400 }); try { return NextResponse.json({ result: await processDocument(parsed.data.imageBase64) }); } catch { return NextResponse.json({ error: "The document could not be read. Please try a clearer image." }, { status: 422 }); } }