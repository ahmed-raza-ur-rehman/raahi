import { NextResponse } from "next/server";
import { z } from "zod";

import { translateText } from "@/lib/ai/translate";

const schema = z.object({
  text: z.string().min(1).max(4000),
  target: z.enum(["en", "ur", "ps", "hkp"]),
  source: z.enum(["en", "ur", "ps", "hkp"]).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Send text and a target language." }, { status: 400 });

  const result = await translateText(parsed.data.text, parsed.data.target, parsed.data.source);
  return NextResponse.json(result);
}
