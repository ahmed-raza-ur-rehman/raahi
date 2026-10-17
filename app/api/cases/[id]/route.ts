import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { findCase, updateCase } from "@/lib/db/repositories/cases";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";
import { getSessionId } from "@/lib/web/session";

type Context = { params: Promise<{ id: string }> };

const schema = z.object({ status: z.enum(["active", "resolved", "escalated"]).optional(), actionId: z.string().max(120).optional(), completed: z.boolean().optional() });
const CASE_ID = /^[A-Za-z0-9_-]{8,64}$/;
const notFound = () => NextResponse.json({ error: "Case not found." }, { status: 404 });
const limits: LegacyLimit[] = [
  { policy: "cases", by: "session" },
  { policy: "read", by: "ip" },
];

/** A case is visible and editable only to the session that created it. Someone else's id looks exactly like a missing one. */
export const GET = guardLegacy<Context>(
  async (_request, { params }) => {
    const { id } = await params;
    if (!CASE_ID.test(id)) return notFound();
    ensureDatabaseSeeded();
    const item = findCase(id, await getSessionId());
    return item ? NextResponse.json({ case: item }) : notFound();
  },
  { name: "getCase", limits },
);

export const PUT = guardLegacy<Context>(
  async (request, { params }) => {
    const parsed = schema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "Invalid case update." }, { status: 400 });
    const { id } = await params;
    if (!CASE_ID.test(id)) return notFound();
    ensureDatabaseSeeded();
    const item = updateCase(id, await getSessionId(), parsed.data);
    return item ? NextResponse.json({ case: item }) : notFound();
  },
  { name: "updateCase", limits, maxBodyBytes: 4 * 1024 },
);
