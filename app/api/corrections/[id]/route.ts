import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getCorrection, reviewCorrection, voteCorrection } from "@/lib/knowledge/corrections";

const schema = z.object({
  action: z.enum(["vote", "review"]),
  status: z.enum(["in_review", "accepted", "rejected"]).optional(),
  reviewerNote: z.string().max(1000).optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const { id } = await context.params;
  const correction = getCorrection(id);
  return correction ? NextResponse.json({ correction }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "That action was not understood." }, { status: 400 });

  const correction =
    parsed.data.action === "vote"
      ? voteCorrection(id)
      : reviewCorrection(id, parsed.data.status ?? "in_review", parsed.data.reviewerNote);

  return correction ? NextResponse.json({ correction }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
