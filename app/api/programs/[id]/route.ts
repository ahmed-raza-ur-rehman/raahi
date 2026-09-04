import { NextResponse } from "next/server";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { findServiceById } from "@/lib/db/repositories/services";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) { ensureDatabaseSeeded(); const service = findServiceById((await params).id); return service ? NextResponse.json({ service }) : NextResponse.json({ error: "Service not found." }, { status: 404 }); }