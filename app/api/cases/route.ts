import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { createCase, listCases } from "@/lib/db/repositories/cases";
import { guardLegacy, type LegacyLimit } from "@/lib/platform/legacy";
import { getSessionId } from "@/lib/web/session";

const text = (max: number) => z.string().trim().min(1).max(max);
const schema = z.object({
  title: text(160),
  titleUr: text(160),
  domain: z.enum(["welfare", "education", "health", "documentation", "disaster", "legal", "employment"]),
  summary: text(2000),
  serviceIds: z.array(z.string().max(80)).max(20),
  actions: z.array(z.object({ label: text(300), labelUr: text(300), serviceId: z.string().max(80).optional() })).max(30),
});

const limits: LegacyLimit[] = [
  { policy: "cases", by: "session" },
  { policy: "read", by: "ip" },
];

/** Only the caller's own cases (the session cookie decides; there is no fallback to anyone else's). */
export const GET = guardLegacy(
  async () => {
    ensureDatabaseSeeded();
    return NextResponse.json({ results: listCases(await getSessionId()) });
  },
  { name: "listCases", limits },
);

export const POST = guardLegacy(
  async (request) => {
    const parsed = schema.safeParse(await request.json().catch(() => undefined));
    if (!parsed.success) return NextResponse.json({ error: "A complete case is required." }, { status: 400 });
    ensureDatabaseSeeded();
    return NextResponse.json({ case: createCase({ ...parsed.data, sessionId: await getSessionId() }) }, { status: 201 });
  },
  { name: "createCase", limits, maxBodyBytes: 64 * 1024 },
);
