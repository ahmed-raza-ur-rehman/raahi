import { getDashScopeClient, isDashScopeConfigured } from "./client";
import { withProvider } from "./resilience";
import { pick } from "@/lib/i18n";
import type { Language, Localized } from "@/lib/types";

export interface TranslationResult {
  text: string;
  language: Language;
  provider: "qwen" | "glossary" | "passthrough";
  confidence: number;
}

const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  ur: "Urdu (اردو)",
  ps: "Pashto (پښتو)",
  hkp: "Hindko (ہندکو)",
};

/**
 * A compact phrase glossary so the platform stays useful with zero API keys.
 * Anything not in the glossary falls back to the deterministic `pick()` resolver
 * on the source `Localized` value, and finally to the source text itself.
 */
const GLOSSARY: Record<string, Localized> = {
  "application fee": { en: "application fee", ur: "درخواست فیس", ps: "د غوښتنې فیس", hkp: "درخواست فیس" },
  deadline: { en: "deadline", ur: "آخری تاریخ", ps: "وروستۍ نېټه", hkp: "آخری تاریخ" },
  documents: { en: "documents", ur: "دستاویزات", ps: "اسناد", hkp: "کاغذات" },
  scholarship: { en: "scholarship", ur: "سکالرشپ", ps: "بورس", hkp: "سکالرشپ" },
  passport: { en: "passport", ur: "پاسپورٹ", ps: "پاسپورټ", hkp: "پاسپورٹ" },
  identity: { en: "identity card", ur: "شناختی کارڈ", ps: "پېژندپاڼه", hkp: "شناختی کارڈ" },
  blood: { en: "blood", ur: "خون", ps: "وینه", hkp: "خون" },
  doctor: { en: "doctor", ur: "ڈاکٹر", ps: "ډاکټر", hkp: "ڈاکٹر" },
  help: { en: "help", ur: "مدد", ps: "مرسته", hkp: "مدد" },
  free: { en: "free", ur: "مفت", ps: "وړیا", hkp: "مفت" },
  apply: { en: "apply", ur: "درخواست دیں", ps: "غوښتنه وکړئ", hkp: "درخواست دیو" },
  eligibility: { en: "eligibility", ur: "اہلیت", ps: "وړتیا", hkp: "اہلیت" },
};

function glossaryTranslate(text: string, target: Language): string | undefined {
  const key = text.trim().toLowerCase();
  const entry = GLOSSARY[key];
  if (entry) return pick(entry, target);
  return undefined;
}

/**
 * Translate a single string. Uses Qwen when a key is configured, otherwise the
 * local glossary, otherwise the source text. Never throws.
 */
export async function translateText(
  text: string,
  target: Language,
  source?: Language,
): Promise<TranslationResult> {
  if (!text.trim()) return { text, language: target, provider: "passthrough", confidence: 1 };

  // Plan B, computed up front so it is ready the instant it is needed.
  const glossary = glossaryTranslate(text, target);
  const fallback = (): TranslationResult =>
    glossary
      ? { text: glossary, language: target, provider: "glossary", confidence: 0.6 }
      : { text, language: target, provider: "passthrough", confidence: 0.3 };

  if (!isDashScopeConfigured()) return fallback();

  const translated = await withProvider<string | undefined>("dashscope-chat", {
    timeoutMs: 8_000,
    label: "translate",
    call: async () => {
      const client = getDashScopeClient();
      const response = await client?.chat.completions.create({
        model: "qwen-plus",
        temperature: 0.1,
        max_tokens: 800,
        messages: [
          {
            role: "system",
            content: `You are a professional translator for Pakistani citizen services. Translate into ${LANGUAGE_NAMES[target]}. Keep numbers, dates, phone numbers, URLs and CNIC formats exactly as they are. Return ONLY the translated text, no explanation and no quotes.`,
          },
          {
            role: "user",
            content: source ? `Source language: ${LANGUAGE_NAMES[source]}\n\n${text}` : text,
          },
        ],
      });
      return response?.choices?.[0]?.message?.content?.trim() ?? undefined;
    },
    fallback: () => undefined,
  });

  if (translated) return { text: translated, language: target, provider: "qwen", confidence: 0.9 };
  return fallback();
}

/**
 * Translate a `Localized` value, generating a missing language on demand.
 * Hindko always falls back to Urdu (same script, mutually intelligible) rather
 * than a machine translation, because that reads better for real users.
 */
export async function ensureLocalized(value: Localized, target: Language): Promise<string> {
  const exact = value[target];
  if (exact && exact.trim().length > 0) return exact;
  if (target === "hkp") return pick(value, target);
  const result = await translateText(value.en ?? pick(value, target), target, "en");
  return result.text;
}

export function translatorFor(target: Language) {
  return {
    target,
    async text(value: string) {
      return (await translateText(value, target)).text;
    },
    localized(value: Localized) {
      return ensureLocalized(value, target);
    },
  };
}
