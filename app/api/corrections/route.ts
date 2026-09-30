import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getSessionId } from "@/lib/web/session";
import { correctionStats, listCorrections, submitCorrection, validateCorrection } from "@/lib/knowledge/corrections";

const schema = z.object({
  entityType: z.string().min(1).max(40),
  entityId: z.string().min(1).max(80),
  field: z.string().min(1).max(80),
  suggestedValue: z.string().min(2).max(1000),
  reportedValue: z.string().max(1000).optional(),
  reason: z.string().max(1000).optional(),
  evidenceUrl: z.string().max(500).optional(),
  reporterContact: z.string().max(30).optional(),
});

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const entityType = url.searchParams.get("entityType") ?? undefined;
  const entityId = url.searchParams.get("entityId") ?? undefined;

  return NextResponse.json({
    corrections: listCorrections({
      ...(status === "pending" || status === "in_review" || status === "accepted" || status === "rejected" ? { status } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    }),
    stats: correctionStats(),
  });
}

export async function POST(request: Request) {
  ensureDatabaseSeeded();
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Please describe the correction." }, { status: 400 });

  const sessionId = await getSessionId();
  const invalid = validateCorrection({ sessionId, ...parsed.data });
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const correction = submitCorrection({ sessionId, ...parsed.data });
  return NextResponse.json({ correction }, { status: 201 });
}
