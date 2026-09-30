import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { runAgentWorkflow } from "@/lib/ai/agents";
import { getSessionId } from "@/lib/web/session";
import type { CitizenProfile } from "@/lib/types";

const schema = z.object({
  query: z.string().trim().min(2).max(1000),
  language: z.enum(["en", "ur", "ps", "hkp"]).optional(),
  profile: z.object({}).passthrough().optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Tell Raahi what you need." }, { status: 400 });

  ensureDatabaseSeeded();
  const sessionId = await getSessionId();

  const response = await runAgentWorkflow({
    query: parsed.data.query,
    ...(parsed.data.language ? { language: parsed.data.language } : {}),
    ...(parsed.data.profile ? { profile: parsed.data.profile as CitizenProfile } : {}),
    sessionId,
  });

  return NextResponse.json(response);
}
