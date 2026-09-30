import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeDocument, PHOTO_CHECKLIST } from "@/lib/ai/vision";

const schema = z.object({
  imageBase64: z.string().min(20).max(8_000_000),
  expectedType: z.string().max(60).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "A document photo is required." }, { status: 400 });

  const result = await analyzeDocument(parsed.data.imageBase64, parsed.data.expectedType);
  return NextResponse.json({ result, checklist: PHOTO_CHECKLIST });
}
