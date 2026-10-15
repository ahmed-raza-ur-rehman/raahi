import { guardLegacy } from "@/lib/platform/legacy";
import { NextResponse } from "next/server";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { findServiceById } from "@/lib/db/repositories/services";
async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) { ensureDatabaseSeeded(); const service = findServiceById((await params).id); return service ? NextResponse.json({ service }) : NextResponse.json({ error: "Service not found." }, { status: 404 }); }

export const GET = guardLegacy<{ params: Promise<{ id: string }> }>(handleGET, { name: "getProgram", limits: [{ policy: "read", by: "ip" }] });
