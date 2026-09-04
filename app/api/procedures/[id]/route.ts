import { NextResponse } from "next/server";
import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { findServiceById } from "@/lib/db/repositories/services";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  ensureDatabaseSeeded();
  const service = findServiceById((await params).id);
  if (!service) {
    return NextResponse.json({ error: "Procedure not found." }, { status: 404 });
  }

  return NextResponse.json({
    serviceId: service.id,
    name: service.name,
    nameUr: service.nameUr,
    namePs: service.namePs,
    domain: service.domain,
    organizationId: service.organizationId,
    description: service.description,
    descriptionUr: service.descriptionUr,
    steps: service.procedure,
    requiredDocuments: service.requiredDocuments,
    source: {
      url: service.sourceUrl,
      title: service.sourceTitle,
      authorityTier: service.sourceAuthorityTier,
      lastVerified: service.lastVerified,
    },
  });
}