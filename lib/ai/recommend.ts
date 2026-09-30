import { listDocuments, listOpportunities, listTests } from "@/lib/knowledge";
import { pick } from "@/lib/i18n";
import type {
  CitizenProfile,
  DocumentRecipe,
  KnowledgeEntityType,
  Language,
  OpportunityRecord,
  TestRecord,
} from "@/lib/types";

export interface Recommendation<T = unknown> {
  entityType: KnowledgeEntityType;
  id: string;
  title: string;
  summary: string;
  score: number;
  reasons: string[];
  /** How close the match is, for a simple colour badge in the UI. */
  strength: "strong" | "good" | "possible";
  url?: string;
  record: T;
}

export type Goal =
  | "study"
  | "study_abroad"
  | "scholarship"
  | "job"
  | "internship"
  | "skills"
  | "business"
  | "documents"
  | "health"
  | "legal"
  | "aid";

const GOAL_KEYWORDS: Record<Goal, string[]> = {
  study: ["study", "admission", "university", "degree", "تعلیم", "داخلہ"],
  study_abroad: ["abroad", "foreign", "usa", "uk", "europe", "visa", "بیرون ملک"],
  scholarship: ["scholarship", "fee", "stipend", "وظیفہ", "سکالرشپ"],
  job: ["job", "naukri", "employment", "نوکری", "روزگار"],
  internship: ["internship", "انٹرنشپ"],
  skills: ["skill", "course", "training", "freelancing", "ہنر", "کورس"],
  business: ["business", "loan", "startup", "کاروبار", "قرضہ"],
  documents: ["cnic", "certificate", "passport", "دستاویز", "سرٹیفکیٹ"],
  health: ["doctor", "hospital", "treatment", "علاج", "صحت"],
  legal: ["legal", "lawyer", "court", "قانونی", "وکیل"],
  aid: ["bisp", "zakat", "bait", "aid", "امداد", "زکوٰۃ"],
};

export function goalsFromText(text: string): Goal[] {
  const value = text.toLowerCase();
  const goals: Goal[] = [];
  for (const [goal, keywords] of Object.entries(GOAL_KEYWORDS)) {
    if (keywords.some((keyword) => value.includes(keyword.toLowerCase()))) goals.push(goal as Goal);
  }
  return goals;
}

function levelProfile(profile: CitizenProfile): string[] {
  const level = (profile.educationLevel ?? "").toLowerCase();
  if (/matric|10th|secondary/.test(level)) return ["matric", "any"];
  if (/intermediate|fsc|fa|12th|college/.test(level)) return ["intermediate", "matric", "any"];
  if (/bachelor|bs|ba|bsc|undergraduate|16/.test(level)) return ["undergraduate", "intermediate", "any"];
  if (/master|msc|ma|ms|mphil/.test(level)) return ["masters", "undergraduate", "any"];
  if (/phd|ph\.d|doctor/.test(level)) return ["phd", "masters", "any"];
  return ["any"];
}

function strengthFor(score: number): Recommendation["strength"] {
  if (score >= 0.62) return "strong";
  if (score >= 0.4) return "good";
  return "possible";
}

/* ────────────────────────────────────────────────────────────────
 * Opportunity scoring
 * ──────────────────────────────────────────────────────────────── */

export interface RecommendOptions {
  profile: CitizenProfile;
  goals?: Goal[];
  language?: Language;
  limit?: number;
}

function scoreOpportunity(record: OpportunityRecord, profile: CitizenProfile, goals: Goal[]): { score: number; reasons: string[] } {
  let score = 0.25;
  const reasons: string[] = [];
  const levels = levelProfile(profile);

  if (record.levels.some((level) => levels.includes(level))) {
    score += 0.18;
    reasons.push("matches your education level");
  }

  if (goals.includes("study_abroad") && record.scope === "international") {
    score += 0.22;
    reasons.push("it is an international opportunity");
  }
  if ((goals.includes("scholarship") || goals.includes("study")) && record.kind === "scholarship") {
    score += 0.18;
    reasons.push("it is a scholarship");
  }
  if (goals.includes("job") && (record.kind === "job")) {
    score += 0.22;
    reasons.push("it is a job route");
  }
  if (goals.includes("internship") && record.kind === "internship") {
    score += 0.24;
    reasons.push("it is an internship route");
  }
  if (goals.includes("skills") && (record.kind === "training" || record.kind === "grant")) {
    score += 0.2;
    reasons.push("it builds skills or funds a livelihood");
  }
  if (goals.includes("business") && (record.kind === "grant" || record.kind === "training")) {
    score += 0.2;
    reasons.push("it supports starting or growing work");
  }

  if (profile.householdIncome !== undefined) {
    const needBased = record.eligibility.some((criterion) => criterion.rule?.field === "householdIncome");
    if (needBased) {
      const ceiling = record.eligibility
        .map((criterion) => criterion.rule)
        .find((rule) => rule?.field === "householdIncome");
      const limit = typeof ceiling?.value === "number" ? ceiling.value : undefined;
      if (limit !== undefined && profile.householdIncome <= limit) {
        score += 0.16;
        reasons.push("your household income is within the stated range");
      } else if (limit !== undefined) {
        score -= 0.12;
      }
    }
  }

  const provinceRequirement = record.eligibility.find((criterion) => criterion.rule?.field === "province")?.rule;
  if (provinceRequirement && profile.province) {
    const allowed = Array.isArray(provinceRequirement.value) ? provinceRequirement.value.map(String) : [String(provinceRequirement.value)];
    if (allowed.includes(profile.province)) {
      score += 0.14;
      reasons.push(`available for ${profile.province}`);
    } else {
      score -= 0.2;
      reasons.push("not open in your province");
    }
  }

  if (profile.age !== undefined) {
    const ageRule = record.eligibility.find((criterion) => criterion.rule?.field === "age")?.rule;
    if (ageRule && Array.isArray(ageRule.value) && ageRule.value.length === 2) {
      const [min, max] = ageRule.value as unknown as [number, number];
      if (profile.age >= min && profile.age <= max) {
        score += 0.08;
        reasons.push("your age is in range");
      }
    }
  }

  if (profile.hasCnic === false && record.requiredDocuments.some((doc) => doc.type === "cnic")) {
    score -= 0.05;
    reasons.push("you will need a CNIC first");
  }

  if (record.applicationFee.amount === null) {
    score += 0.04;
    reasons.push("free to apply");
  }

  if (record.source.tier <= 2) {
    score += 0.05;
    reasons.push("official source");
  }

  return { score: Math.max(0, Math.min(1, score)), reasons };
}

/* ────────────────────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────────────────────── */

export function recommendOpportunities(options: RecommendOptions): Recommendation<OpportunityRecord>[] {
  const { profile, goals = [], language = "ur", limit = 8 } = options;
  return listOpportunities()
    .map((record) => {
      const { score, reasons } = scoreOpportunity(record, profile, goals);
      return {
        entityType: "opportunity" as const,
        id: record.id,
        title: pick(record.title, language),
        summary: pick(record.benefit, language),
        score: Number(score.toFixed(3)),
        reasons,
        strength: strengthFor(score),
        url: record.officialUrl,
        record,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

/** Documents a citizen should get next, based on what their target needs. */
export function recommendDocuments(
  opportunity: OpportunityRecord | undefined,
  profile: CitizenProfile,
  language: Language = "ur",
): Recommendation<DocumentRecipe>[] {
  const needed = new Set<string>(opportunity?.requiredDocuments.map((doc) => doc.type) ?? []);
  if (profile.hasCnic === false) needed.add("cnic");
  if (profile.wantsToStudyAbroad) {
    needed.add("passport");
    needed.add("degree");
  }

  return listDocuments()
    .map((record) => {
      const reasons: string[] = [];
      let score = 0.15;
      if (needed.has(record.type)) {
        score += 0.55;
        reasons.push("required for your chosen application");
      }
      if (needed.size === 0 && ["cnic", "family_registration_certificate", "domicile"].includes(record.type)) {
        score += 0.25;
        reasons.push("useful to have ready in advance");
      }
      return {
        entityType: "document" as const,
        id: record.id,
        title: pick(record.name, language),
        summary: pick(record.purpose, language),
        score: Number(score.toFixed(3)),
        reasons,
        strength: strengthFor(score),
        url: record.onlineChannel?.url ?? record.source.url,
        record,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 6);
}

/** Tests worth preparing for, given the citizen's goals. */
export function recommendTests(profile: CitizenProfile, goals: Goal[], language: Language = "ur"): Recommendation<TestRecord>[] {
  const wantsAbroad = goals.includes("study_abroad") || profile.wantsToStudyAbroad === true;
  const wantsJob = goals.includes("job");
  return listTests()
    .map((record) => {
      const reasons: string[] = [];
      let score = 0.15;
      if (wantsAbroad && record.category === "english") {
        score += 0.55;
        reasons.push("needed for study or migration abroad");
      }
      if (wantsJob && (record.category === "competitive" || record.category === "aptitude")) {
        score += 0.45;
        reasons.push("used for government and graduate jobs");
      }
      if (goals.includes("study") && record.category === "admission") {
        score += 0.4;
        reasons.push("an admission test for your field");
      }
      if (profile.englishLevel === "basic" && record.category === "english") {
        reasons.push("start early — English tests take the longest to prepare for");
      }
      return {
        entityType: "test" as const,
        id: record.id,
        title: pick(record.name, language),
        summary: pick(record.purpose, language),
        score: Number(score.toFixed(3)),
        reasons,
        strength: strengthFor(score),
        url: record.officialUrl,
        record,
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, 5);
}

/** One call that assembles a complete personal plan. */
export function recommendPlan(options: RecommendOptions) {
  const goals = options.goals ?? [];
  const language = options.language ?? "ur";
  const opportunities = recommendOpportunities({ ...options, goals, limit: options.limit ?? 6 });
  const top = opportunities[0]?.record;
  return {
    opportunities,
    documents: recommendDocuments(top, options.profile, language),
    tests: recommendTests(options.profile, goals, language),
    goals,
  };
}
