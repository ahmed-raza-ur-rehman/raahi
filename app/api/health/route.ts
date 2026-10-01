import { NextResponse } from "next/server";

import { providerHealth } from "@/lib/ai/resilience";
import { summariseFreshness, type VerifiableKind } from "@/lib/freshness";
import { APP_NAME, APP_VERSION, BUILD_COMMIT_SHORT } from "@/lib/version";
import { bloodBanks } from "@/data/blood";
import { contacts } from "@/data/contacts";
import { disasterGuides } from "@/data/disaster";
import { documentRecipes } from "@/data/documents";
import { diseaseSignals, medicalCamps, medicalProcedures } from "@/data/health";
import { legalTopics } from "@/data/legal";
import { opportunities } from "@/data/opportunities";
import { scholarships } from "@/data/scholarships";
import { tests } from "@/data/tests";

/**
 * Health check, for a load balancer and for whoever is on call.
 *
 * Two things matter here and nothing else:
 *  1. Can we still serve a citizen right now? That is true as long as our own
 *     data is readable — the AI provider is an enhancement, not a dependency.
 *  2. What is quietly going wrong? A provider with an open circuit, or a block
 *     of records nobody has re-checked in months.
 *
 * Deliberately reports capabilities as booleans and never echoes a secret, a
 * key or a file path.
 */

export const dynamic = "force-dynamic";

type Verifiable = { id: string; source?: { lastVerified?: string } };

function collect(records: Verifiable[], kind: VerifiableKind) {
  return records.map((record) => ({
    id: record.id,
    kind,
    lastVerified: record.source?.lastVerified,
  }));
}

export async function GET() {
  const providers = providerHealth();
  const anyProviderDown = Object.values(providers).some((state) => state.open);

  const records = [
    ...collect(opportunities, "opportunity"),
    ...collect(scholarships, "opportunity"),
    ...collect(tests, "test"),
    ...collect(medicalCamps, "camp"),
    ...collect(contacts, "contact"),
    ...collect(bloodBanks, "blood"),
    ...collect(disasterGuides, "disaster"),
    ...collect(documentRecipes, "guide"),
    ...collect(legalTopics, "guide"),
    ...collect(medicalProcedures, "guide"),
    ...collect(diseaseSignals, "guide"),
  ];
  const freshness = summariseFreshness(records);

  // Raahi answers from its own verified data even with no AI provider at all,
  // so a provider outage is "degraded", never "down".
  const status = freshness.stale > records.length / 2 ? "degraded" : anyProviderDown ? "degraded" : "ok";

  return NextResponse.json(
    {
      status,
      // A machine can branch on this without parsing the strings.
      ready: true,
      time: new Date().toISOString(),
      // Which code is actually running, for the person debugging a report.
      version: APP_VERSION,
      name: APP_NAME,
      ...(BUILD_COMMIT_SHORT ? { commit: BUILD_COMMIT_SHORT } : {}),
      providers,
      capabilities: {
        // Present but never valued, so this is safe to expose.
        ai: Boolean(process.env.DASHSCOPE_API_KEY),
        webSearch: Boolean(process.env.SERPER_API_KEY || process.env.BRAVE_SEARCH_API_KEY || process.env.GOOGLE_CSE_API_KEY),
        database: true,
        knowledgeRecords: records.length,
      },
      dataFreshness: {
        ...freshness,
        // Only the ids, and only when something actually needs a re-check:
        // enough for a reviewer to act, not a dump of the corpus.
        staleIds: freshness.staleIds.slice(0, 50),
      },
    },
    // Always 200: a degraded Raahi still answers a citizen, so a provider
    // outage must not make a load balancer take the whole site out of service.
    { headers: { "cache-control": "no-store" } },
  );
}
