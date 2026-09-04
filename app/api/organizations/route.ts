import { NextResponse } from "next/server";
import { z } from "zod";
import { listOrganizations, createOrganization } from "@/lib/db/repositories/services";
import { organizations as fallbackOrganizations } from "@/data/catalog";
import { ensureDatabaseSeeded } from "@/lib/db/seed";

const orgSchema = z.object({
  id: z.string().min(2).max(64),
  name: z.string().min(2).max(128),
  nameUr: z.string().min(2).max(128),
  type: z.enum(["government", "ngo", "hospital"]),
  sourceUrl: z.string().url(),
  authorityTier: z.number().int().min(1).max(5),
});

export async function GET() {
  ensureDatabaseSeeded();
  try {
    const list = listOrganizations();
    return NextResponse.json({ results: list.length > 0 ? list : fallbackOrganizations });
  } catch {
    return NextResponse.json({ results: fallbackOrganizations });
  }
}

export async function POST(request: Request) {
  ensureDatabaseSeeded();
  const body = await request.json().catch(() => null);
  const parsed = orgSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid organization data", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const created = createOrganization(parsed.data);
  return NextResponse.json({ organization: created }, { status: 201 });
}