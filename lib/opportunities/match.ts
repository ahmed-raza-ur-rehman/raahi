import type { Level, OpportunityKind, OpportunityView, Scope } from "./types";

/**
 * "Find opportunities for me": scores listings against a short profile and says WHY each one was
 * picked (and what to double-check). Transparent rules, no black box, nothing is stored.
 */

export interface MatchProfile {
  /** Level the person wants to study or work at. */
  level?: Level;
  fields?: string[];
  interests?: OpportunityKind[];
  gender?: "female" | "male";
  /** Preferred destination country, if any. */
  country?: string;
  scope?: Scope;
  needsFunding?: boolean;
  remoteOk?: boolean;
  keywords?: string;
}

export interface Reason {
  en: string;
  ur: string;
}

export interface MatchResult {
  item: OpportunityView;
  score: number;
  reasons: Reason[];
  warnings: Reason[];
}

const WOMEN_FOCUS = /\b(?:women|woman|female|girls?)\b/i;
/** Audience wording ("for women", "women in tech", "women's fellowship"), not a mere topic like "women's health research". */
const WOMEN_AUDIENCE = /\b(?:for|only for|exclusively for)\s+(?:young\s+)?(?:women|woman|female|girls?)\b|\bwomen[- ]only\b|\bfemale[- ]only\b|\bwomen\s+in\b|\bwomen['’]s\s+(?:scholarship|fellowship|program|programme|grant|award|leadership|prize)\b|\bwomen[- ]led\b|\bgirls['’]?\s+(?:scholarship|program|programme)\b/i;
const MEN_ONLY = /\b(?:men only|male only|boys only)\b/i;

export function scoreMatch(profile: MatchProfile, item: OpportunityView): MatchResult | undefined {
  const text = `${item.title} ${item.summary ?? ""} ${item.tags.join(" ")}`;
  const reasons: Reason[] = [];
  const warnings: Reason[] = [];
  let score = 0;

  if (item.status === "closed") return undefined;
  if (item.openToPakistan === false) return undefined; // clearly restricted to others
  if (profile.gender === "male" && WOMEN_AUDIENCE.test(`${item.title}. ${item.summary ?? ""}`)) return undefined;
  if (profile.gender === "female" && MEN_ONLY.test(text)) return undefined;

  if (profile.interests && profile.interests.length > 0) {
    if (!profile.interests.includes(item.kind)) return undefined;
    score += 3;
    reasons.push({ en: `It is a ${item.kind}, which you asked for.`, ur: "یہ وہی قسم ہے جو آپ نے منتخب کی۔" });
  }

  if (profile.level && item.levels.length > 0) {
    if (item.levels.includes(profile.level) || item.levels.includes("any")) {
      score += 3;
      reasons.push({ en: `Open at your level (${profile.level}).`, ur: `آپ کی سطح (${profile.level}) کے لیے کھلا ہے۔` });
    } else {
      score -= 2;
      warnings.push({ en: `Listed for ${item.levels.join(", ")}, not ${profile.level}.`, ur: `یہ ${item.levels.join("، ")} کے لیے درج ہے، ${profile.level} کے لیے نہیں۔` });
    }
  }

  const sharedFields = (profile.fields ?? []).filter((field) => item.fields.includes(field));
  if (sharedFields.length > 0) {
    score += Math.min(4, sharedFields.length * 2);
    reasons.push({ en: `Matches your field: ${sharedFields.join(", ")}.`, ur: `آپ کے شعبے سے ملتا ہے: ${sharedFields.join("، ")}۔` });
  }

  const keywords = (profile.keywords ?? "").toLowerCase().split(/[\s,]+/).filter((word) => word.length > 2);
  const hits = keywords.filter((word) => text.toLowerCase().includes(word));
  if (hits.length > 0) {
    score += Math.min(4, hits.length);
    reasons.push({ en: `Mentions what you searched for: ${hits.slice(0, 3).join(", ")}.`, ur: `آپ کی تلاش کے الفاظ شامل ہیں: ${hits.slice(0, 3).join("، ")}۔` });
  }

  if (profile.country && item.country && item.country.toLowerCase() === profile.country.toLowerCase()) {
    score += 3;
    reasons.push({ en: `Located in ${item.country}.`, ur: `${item.country} میں ہے۔` });
  }
  if (profile.scope && item.scope === profile.scope) score += 1;

  if (profile.needsFunding && item.funding) {
    if (item.funding === "full") {
      score += 3;
      reasons.push({ en: "Fully funded.", ur: "مکمل فنڈڈ۔" });
    } else if (["partial", "stipend", "paid", "free"].includes(item.funding)) {
      score += 2;
      reasons.push({ en: `Funding: ${item.funding}.`, ur: `فنڈنگ: ${item.funding}۔` });
    }
  }
  if (profile.gender === "female" && WOMEN_FOCUS.test(item.title)) {
    score += 3;
    reasons.push({ en: "Specifically for women.", ur: "خاص طور پر خواتین کے لیے۔" });
  }

  if (item.remote) {
    if (profile.remoteOk) {
      score += 1;
      reasons.push({ en: "Can be done remotely.", ur: "گھر بیٹھے/آن لائن کیا جا سکتا ہے۔" });
    } else if (profile.remoteOk === false) {
      score -= 1;
    }
  }

  if (item.openToPakistan === true) {
    score += 1;
    reasons.push({ en: "Pakistan is mentioned or applicants are international.", ur: "پاکستان کا ذکر ہے یا بین الاقوامی امیدوار اہل ہیں۔" });
  } else if (item.openToPakistan === undefined) {
    warnings.push({ en: "Check on the official page that applicants from Pakistan are eligible.", ur: "سرکاری صفحے پر دیکھ لیں کہ پاکستان کے امیدوار اہل ہیں۔" });
  }

  if (item.daysLeft !== null && item.daysLeft >= 0) {
    if (item.daysLeft <= 7) {
      score += 1;
      warnings.push({ en: `Closes in ${item.daysLeft} day${item.daysLeft === 1 ? "" : "s"} — act now.`, ur: `${item.daysLeft} دن میں بند ہو رہا ہے — فوراً کارروائی کریں۔` });
    }
  }

  return score > 0 ? { item, score, reasons, warnings } : undefined;
}

export function rankMatches(profile: MatchProfile, items: OpportunityView[], limit = 12): MatchResult[] {
  return items
    .map((item) => scoreMatch(profile, item))
    .filter((result): result is MatchResult => result !== undefined)
    .sort((a, b) => b.score - a.score || (a.item.daysLeft ?? 9999) - (b.item.daysLeft ?? 9999))
    .slice(0, limit);
}
