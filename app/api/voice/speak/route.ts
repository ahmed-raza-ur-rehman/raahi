import { NextResponse } from "next/server";
import { z } from "zod";

import { synthesizeSpeech } from "@/lib/ai/voice";

const schema = z.object({
  text: z.string().min(1).max(1500),
  language: z.enum(["en", "ur", "ps", "hkp"]).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Text is required." }, { status: 400 });
  return NextResponse.json(await synthesizeSpeech(parsed.data.text, parsed.data.language ?? "ur"));
}
