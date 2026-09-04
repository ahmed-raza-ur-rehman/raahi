import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { findServiceById } from "@/lib/db/repositories/services";
import { eligibilityEngine } from "@/lib/eligibility";
const schema = z.object({ serviceId: z.string().min(1), profile: z.record(z.string(), z.unknown()), providedDocumentTypes: z.array(z.string()).optional() });
export async function POST(request: Request) { const parsed = schema.safeParse(await request.json().catch(() => undefined)); if (!parsed.success) return NextResponse.json({ error: "serviceId and profile are required." }, { status: 400 }); ensureDatabaseSeeded(); const service = findServiceById(parsed.data.serviceId); if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 }); return NextResponse.json({ result: eligibilityEngine.evaluate({ service, profile: parsed.data.profile, providedDocumentTypes: parsed.data.providedDocumentTypes }) }); }