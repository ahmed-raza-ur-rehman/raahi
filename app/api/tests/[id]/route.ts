import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getEntity, listTests } from "@/lib/knowledge";
import type { TestRecord } from "@/lib/types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const { id } = await context.params;
  const record = getEntity<TestRecord>(id) ?? listTests().find((test) => test.shortName.toLowerCase() === id.toLowerCase());
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ record });
}
