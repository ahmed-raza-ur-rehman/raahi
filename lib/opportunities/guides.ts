import { GUIDES } from "@/data/opportunities/guides";
import type { Language } from "@/lib/types";
import type { EcosystemApp } from "./ecosystem";
import { pickText, type LText } from "./ltext";
import type { Funding, Level, OpportunityKind, Scope } from "./types";

/**
 * How-to guidance for the situations people actually search for ("fsc ke baad kya karein", "fake visa agent",
 * "apostille kaise"). A guide is a short, ordered path with a checklist, the mistakes people make and links to
 * official sources — never a list of fees, ages, quotas or dates that RAAHI cannot keep correct. Where a fact is
 * stated, the guide names the official page it comes from (`sources`) and when it was last reviewed.
 */

export { pickText } from "./ltext";
export type { LText } from "./ltext";

export const GUIDE_CATEGORIES = ["study", "careers", "abroad", "skills", "safety", "documents"] as const;
export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

export type GuideToolId = "scam" | "match" | "plan" | "age" | "cv" | "abroad";

export interface GuideStep {
  title: LText;
  body: LText;
  /** Rough timing, e.g. "9–8 months before the deadline". */
  when?: LText;
  /** Directory resources that help with this very step. */
  resourceIds?: string[];
}

export interface Guide {
  /** URL slug. */
  id: string;
  category: GuideCategory;
  emoji: string;
  title: LText;
  summary: LText;
  audience: LText;
  duration?: LText;
  steps: GuideStep[];
  /** Things to have ready. */
  checklist: LText[];
  /** Mistakes and scams to avoid. */
  pitfalls: LText[];
  /** Official links shown as the guide's reference panel (directory ids; validated by tests). */
  resourceIds: string[];
  related?: string[];
  /** Live listings that belong with this guide. */
  opportunityQuery?: { q?: string; kinds?: OpportunityKind[]; scope?: Scope; level?: Level; funding?: Funding; openToPakistan?: boolean; remote?: boolean };
  /** RAAHI's own companion apps that help with this guide. */
  appIds?: Array<EcosystemApp["id"]>;
  tools?: GuideToolId[];
  /** Search words in English, Roman Urdu and Urdu. */
  keywords: string[];
  /** YYYY-MM-DD: when the facts in this guide were last checked against the official pages. */
  reviewed: string;
  /** Official pages the guide's concrete facts come from. */
  sources?: string[];
}

export const CATEGORY_TITLES: Record<GuideCategory, LText & { emoji: string }> = {
  study: { emoji: "🎓", en: "Study & admissions", ur: "تعلیم اور داخلے" },
  careers: { emoji: "💼", en: "Careers & jobs", ur: "کیریئر اور نوکریاں" },
  abroad: { emoji: "✈️", en: "Going abroad", ur: "بیرون ملک" },
  skills: { emoji: "🧠", en: "Skills & learning", ur: "ہنر اور سیکھنا" },
  safety: { emoji: "🛡️", en: "Safety & scams", ur: "تحفظ اور فراڈ" },
  documents: { emoji: "📄", en: "Documents", ur: "دستاویزات" },
};


export function listGuides(): Guide[] {
  return GUIDES;
}

export function getGuide(id: string): Guide | undefined {
  return GUIDES.find((guide) => guide.id === id);
}

// ─── Search ──────────────────────────────────────────────────────────────────

// Words that carry no topic: English question words and the Roman-Urdu / Urdu equivalents.
const STOPWORDS = new Set([
  "how", "to", "the", "a", "an", "for", "in", "on", "of", "and", "or", "my", "i", "me", "do", "can", "what", "is", "are", "get", "with", "from", "about", "guide", "help", "need", "want",
  "kaise", "kese", "kaisay", "kya", "ke", "ka", "ki", "ko", "mein", "main", "me", "hai", "hain", "karein", "karen", "karna", "kare", "kar", "se", "par", "pe", "aur", "ya", "liye", "lie", "mujhe", "hum", "apna",
  "کیسے", "کیا", "کے", "کی", "کا", "کو", "میں", "ہے", "ہیں", "کریں", "کرنا", "سے", "پر", "اور", "یا", "لیے", "مجھے", "ہم", "اپنا",
]);

function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0300-\u036F]/g, "") // diacritics and Arabic marks
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[^\p{L}\p{N}\s]/gu, " ");
}

export function tokenize(text: string): string[] {
  return fold(text).split(/\s+/).filter((word) => word.length > 1 && !STOPWORDS.has(word));
}

interface Haystack {
  weight: number;
  words: string[];
}

function haystacks(guide: Guide): Haystack[] {
  const both = (value: LText) => `${value.en} ${value.ur}`;
  return [
    { weight: 6, words: tokenize(both(guide.title)) },
    { weight: 5, words: guide.keywords.flatMap(tokenize) },
    { weight: 3, words: tokenize(both(guide.summary)) },
    { weight: 2, words: tokenize(guide.steps.map((step) => both(step.title)).join(" ")) },
    { weight: 1, words: tokenize(guide.steps.map((step) => both(step.body)).join(" ")) },
  ];
}

const index = new Map<string, Haystack[]>();
const haystackFor = (guide: Guide) => {
  let value = index.get(guide.id);
  if (!value) {
    value = haystacks(guide);
    index.set(guide.id, value);
  }
  return value;
};

export interface GuideQuery {
  q?: string;
  category?: GuideCategory;
  limit?: number;
}

/** A match strong enough to put in front of someone who did not ask for a guide: a title or keyword hit. */
export const STRONG_MATCH = 5;

/** Guides matching the question, best first. With no question, every guide in curated order. */
export function searchGuides(query: GuideQuery = {}): Guide[] {
  return searchGuidesScored(query).map((entry) => entry.guide);
}

/** Like `searchGuides`, with the relevance score (title 6, keyword 5, summary 3, step title 2, body 1 per matched word). */
export function searchGuidesScored(query: GuideQuery = {}): Array<{ guide: Guide; score: number }> {
  const pool = query.category ? GUIDES.filter((guide) => guide.category === query.category) : GUIDES;
  const tokens = [...new Set(tokenize(query.q ?? ""))];
  const limit = query.limit ?? pool.length;
  if (tokens.length === 0) return pool.slice(0, limit).map((guide) => ({ guide, score: 0 }));

  const scored: Array<{ guide: Guide; score: number; order: number }> = [];
  pool.forEach((guide, order) => {
    let score = 0;
    let matched = 0;
    for (const token of tokens) {
      let best = 0;
      for (const { weight, words } of haystackFor(guide)) {
        const hit = words.some((word) => word === token || (token.length >= 3 && (word.startsWith(token) || (word.length >= 4 && token.startsWith(word)))));
        if (hit) best = Math.max(best, weight);
      }
      if (best > 0) matched += 1;
      score += best;
    }
    if (matched >= Math.min(Math.ceil(tokens.length / 2), 2)) scored.push({ guide, score, order });
  });
  return scored
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map(({ guide, score }) => ({ guide, score }));
}

/** Compact form for lists, the API and the assistant. */
export function summarizeGuide(guide: Guide, language: Language = "en") {
  return {
    id: guide.id,
    category: guide.category,
    emoji: guide.emoji,
    title: pickText(language, guide.title),
    summary: pickText(language, guide.summary),
    steps: guide.steps.length,
    duration: guide.duration ? pickText(language, guide.duration) : undefined,
    reviewed: guide.reviewed,
    url: `/opportunities/guides/${guide.id}`,
  };
}
