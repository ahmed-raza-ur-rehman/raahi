import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listContacts } from "@/lib/knowledge";
import { EMERGENCY_NUMBERS } from "@/data/contacts";

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const category = new URL(request.url).searchParams.get("category") ?? undefined;
  const results = listContacts(category).sort((a, b) => a.tier - b.tier);
  return NextResponse.json({
    results,
    emergency: EMERGENCY_NUMBERS,
    note: "Numbers can change. Always confirm on the official source before relying on one.",
  });
}
