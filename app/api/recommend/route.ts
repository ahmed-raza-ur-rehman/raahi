import { NextResponse } from "next/server";
import { z } from "zod";

import { ensureDatabaseSeeded } from "@/lib/db/seed";
import { recommendPlan, goalsFromText } from "@/lib/ai/recommend";
import type { CitizenProfile, Language } from "@/lib/types";

const schema = z.object({
  query: z.string().max(500).optional(),
  language: z.enum(["en", "ur", "ps", "hkp"]).optional(),
  profile: z
    .object({
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
      gpa: z.number().optional(),
      englishLevel: z.enum(["none", "basic", "intermediate", "advanced"]).optional(),
      wantsToStudyAbroad: z.boolean().optional(),
      hasPassport: z.boolean().optional(),
      goals: z.array(z.string()).optional(),
      skills: z.array(z.string()).optional(),
    })
    .default({}),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "That profile could not be read." }, { status: 400 });

  ensureDatabaseSeeded();
  const language = (parsed.data.language ?? "ur") as Language;
  const goals = [...(parsed.data.profile.goals ?? []), ...goalsFromText(parsed.data.query ?? "")];

  const plan = recommendPlan({
    profile: parsed.data.profile as CitizenProfile,
    goals: Array.from(new Set(goals)) as never,
    language,
  });

  return NextResponse.json({ ...plan, language });
}
