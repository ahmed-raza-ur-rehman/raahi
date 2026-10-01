import { NextResponse } from "next/server";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { getEntity, listDocuments } from "@/lib/knowledge";
import type { DocumentRecipe } from "@/lib/types";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const { id } = await context.params;
  const record = getEntity<DocumentRecipe>(id) ?? listDocuments().find((doc) => doc.type === id);
  if (!record) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ record });
}
