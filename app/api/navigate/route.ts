import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { eligibilityEngine } from "@/lib/eligibility/engine";
import type { CitizenProfile, Domain, Language } from "@/lib/types";
import { searchServicesHybrid } from "@/lib/rag/search";

const requestSchema = z.object({
  query: z.string().trim().min(2).max(1000),
  language: z.enum(["en", "ur", "ps"]).optional(),
  profile: z.object({
    province: z.string().optional(),
    district: z.string().optional(),
    householdIncome: z.number().nonnegative().optional(),
    householdSize: z.number().int().positive().optional(),
    gender: z.string().optional(),
    age: z.number().int().nonnegative().optional(),
    hasCnic: z.boolean().optional(),
    isBispBeneficiary: z.boolean().optional(),
    isEnrolled: z.boolean().optional(),
    educationLevel: z.string().optional(),
    pmtScore: z.number().nonnegative().optional(),
    specialConditions: z.array(z.string()).optional(),
  }).default({}),
});

import { detectLanguage } from "@/lib/ai/language";

function detectDomain(query: string): Domain | undefined {
  const value = query.toLocaleLowerCase();
  if (/bisp|8171|امداد|مالی|کفالت|welfare|financial/.test(value)) return "welfare";
  if (/scholar|school|fee|وظیف|تعلیم|education|کورس|training/.test(value)) return "education";
  if (/dialysis|hospital|doctor|علاج|ہسپتال|صحت|health|ambulance|ایمرجنسی/.test(value)) return "health";
  if (/passport|cnic|domicile|certificate|شناخت|پاسپورٹ|ڈومیسائل|سرٹیفکیٹ/.test(value)) return "documentation";
  if (/flood|disaster|سیلاب|آفت|relief|ریلیف/.test(value)) return "disaster";
  return undefined;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please share a little more about what you need." }, { status: 400 });
  }

  ensureDatabaseSeeded();
  const { query, profile, language: requestedLanguage } = parsed.data;
  const language = detectLanguage(query, requestedLanguage);
  const results = await searchServicesHybrid({
    query,
    domain: detectDomain(query),
    province: profile.province,
    limit: 5,
  });

  return NextResponse.json({
    language,
    results: results.map((result) => ({
      service: {
        id: result.service.id,
        name: result.service.name,
        nameUr: result.service.nameUr,
        namePs: result.service.namePs,
        description: result.service.description,
        descriptionUr: result.service.descriptionUr,
        domain: result.service.domain,
        applicationMethod: result.service.applicationMethod,
        procedure: result.service.procedure,
        requiredDocuments: result.service.requiredDocuments,
      },
      citation: result.citation,
      reasons: result.reasons,
      eligibility: eligibilityEngine.evaluate({ service: result.service, profile: profile as CitizenProfile }),
    })),
  });
}