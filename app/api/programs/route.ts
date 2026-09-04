import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { listActiveServices, createService } from "@/lib/db/repositories/services";
import type { ServiceRecord } from "@/lib/types";

const serviceSchema = z.object({
  id: z.string().min(2).max(80),
  organizationId: z.string().min(2).max(64),
  domain: z.enum(["welfare", "education", "health", "documentation", "disaster", "legal", "employment"]),
  name: z.string().min(2).max(160),
  nameUr: z.string().min(2).max(160),
  namePs: z.string().optional().default(""),
  description: z.string().min(5),
  descriptionUr: z.string().min(5),
  aliases: z.array(z.string()).default([]),
  coverage: z.array(z.string()).default(["Pakistan"]),
  applicationMethod: z.enum(["online", "in_person", "phone", "sms", "mixed"]).default("in_person"),
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(2),
  sourceAuthorityTier: z.number().int().min(1).max(5).default(1),
  lastVerified: z.string().default(new Date().toISOString().slice(0, 10)),
  active: z.boolean().default(true),
  eligibilityRules: z.array(
    z.object({
      field: z.any(),
      operator: z.any(),
      value: z.any(),
      description: z.string(),
      mandatory: z.boolean(),
    })
  ).default([]),
  requiredDocuments: z.array(
    z.object({
      type: z.string(),
      label: z.string(),
      labelUr: z.string(),
      mandatory: z.boolean(),
    })
  ).default([]),
  procedure: z.array(
    z.object({
      order: z.number().int(),
      title: z.string(),
      titleUr: z.string(),
      description: z.string(),
      descriptionUr: z.string(),
      channel: z.enum(["online", "in_person", "phone", "sms"]),
      url: z.string().optional(),
    })
  ).default([]),
});

export async function GET(request: Request) {
  ensureDatabaseSeeded();
  const url = new URL(request.url);
  const domain = url.searchParams.get("domain");
  const province = url.searchParams.get("province");
  const search = url.searchParams.get("q")?.toLowerCase();

  let services = listActiveServices();

  if (domain) {
    services = services.filter((s) => s.domain === domain);
  }

  if (province) {
    services = services.filter(
      (s) => s.coverage.includes("Pakistan") || s.coverage.includes(province)
    );
  }

  if (search) {
    services = services.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.nameUr.includes(search) ||
        s.description.toLowerCase().includes(search) ||
        s.descriptionUr.includes(search) ||
        s.aliases.some((a) => a.toLowerCase().includes(search))
    );
  }

  return NextResponse.json({ results: services });
}

export async function POST(request: Request) {
  ensureDatabaseSeeded();
  const body = await request.json().catch(() => null);
  const parsed = serviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid service schema", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const created = createService(parsed.data as ServiceRecord);
  return NextResponse.json({ service: created }, { status: 201 });
}