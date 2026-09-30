import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listMedicalProcedures } from "@/lib/knowledge";

export async function GET() {
  ensureDatabaseSeeded();
  return NextResponse.json({ results: listMedicalProcedures() });
}
