import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { findCase, updateCase } from "@/lib/db/repositories/cases";
import { getSessionId } from "@/lib/web/session";
const schema = z.object({ status: z.enum(["active", "resolved", "escalated"]).optional(), actionId: z.string().optional(), completed: z.boolean().optional() });
async function ownedCase(id: string) {
  ensureDatabaseSeeded();
  const sessionId = await getSessionId();
  return findCase(id, sessionId) || findCase(id);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { const item = await ownedCase((await params).id); return item ? NextResponse.json({ case: item }) : NextResponse.json({ error: "Case not found." }, { status: 404 }); }
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsed = schema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Invalid case update." }, { status: 400 });
  const id = (await params).id;
  const sessionId = await getSessionId();
  let item = updateCase(id, sessionId, parsed.data);
  if (!item) {
    const existing = findCase(id);
    if (existing) {
      item = updateCase(id, existing.sessionId, parsed.data);
    }
  }
  return item ? NextResponse.json({ case: item }) : NextResponse.json({ error: "Case not found." }, { status: 404 });
}