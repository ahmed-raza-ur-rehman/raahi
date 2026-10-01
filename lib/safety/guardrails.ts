import type { Domain, Language } from "@/lib/types";

// ─── Prompt Injection & Adversarial Patterns ──────────────────────────────
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rules)/i,
  /reveal\s+(system\s+)?(prompt|instructions|secret)/i,
  /override\s+(system|safety|security)\s+(rules|guidelines)/i,
  /act\s+as\s+(an?\s+unfiltered|jailbroken|developer\s+mode)/i,
  /you\s+are\s+no\s+longer\s+raahi/i,
  /forget\s+all\s+rules/i,
  /سابقہ\s+ہدایات\s+بھول\s+جاؤ/i,
  /سسٹم\s+پرامپٹ\s+دکھاؤ/i,
];

// ─── PII Masking Patterns ──────────────────────────────────────────────────
const CNIC_REGEX = /\b(\d{5})-?(\d{7})-?(\d{1})\b/g;
const PHONE_REGEX = /\b(03\d{2})-?(\d{3})-?(\d{4})\b/g;

/**
 * Sanitizes user input against prompt injections and malicious instructions.
 */
export function sanitizeUserInput(input: string): { sanitized: string; flagged: boolean; reason?: string } {
  if (!input || typeof input !== "string") {
    return { sanitized: "", flagged: false };
  }

  // Check injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        sanitized: "I need guidance regarding public citizen services in Pakistan.",
        flagged: true,
        reason: "Adversarial prompt injection pattern detected and neutralized.",
      };
    }
  }

  // Strip dangerous HTML / script tags
  const sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();

  return { sanitized, flagged: false };
}

/**
 * Masks Personally Identifiable Information (CNIC, Phone) for privacy compliance.
 */
export function maskPii(text: string): string {
  if (!text) return "";
  return text
    .replace(CNIC_REGEX, "$1-XXXXXXX-$3")
    .replace(PHONE_REGEX, "$1-XXX-$3");
}

/**
 * Ensures strict domain disclaimers are attached to responses to prevent liability.
 */
export function appendDomainSafetyDisclaimer(text: string, domain: Domain | string, language: Language = "ur"): string {
  if (domain === "health") {
    const disclaimers: Partial<Record<Language, string>> & Record<"en", string> = {
      ur: "\n\n⚠️ **طبی احتیاط:** راہی صرف فلاحی ہسپتالوں اور سرکاری سہولیات تک رہنمائی فراہم کرتا ہے۔ یہ طبی تشخیص یا دوا کی سفارش نہیں ہے۔ ایمرجنسی کی صورت میں فوری **1122** پر کال کریں۔",
      en: "\n\n⚠️ **Medical Disclaimer:** RAAHI provides access navigation only, not medical diagnosis or prescription. In case of an emergency, call **1122** immediately.",
      ps: "\n\n⚠️ **طبي خبرداری:** راہی یوازې روغتیايي اسانتیاوو ته لارښوونه کوي، دا طبي نسخه یا درملنه نه ده. په بیړني حالت کې **1122** ته زنګ ووهئ.",
    };
    if (!text.includes("1122") && !text.includes("طبی احتیاط") && !text.includes("Medical Disclaimer")) {
      return text + (disclaimers[language] ?? disclaimers.ur ?? disclaimers.en);
    }
  }

  if (domain === "legal") {
    const disclaimers: Partial<Record<Language, string>> & Record<"en", string> = {
      ur: "\n\n⚖️ **قانونی وضاحت:** یہ معلومات عام رہنمائی کے لیے ہیں۔ یہ قانونی وکیل کا متبادل نہیں ہے۔ مفت قانونی مدد کے لیے لیگل ایڈ سوسائٹی ہیلپ لائن **0800-70806** پر رابطہ کریں۔",
      en: "\n\n⚖️ **Legal Notice:** This information is for general procedural guidance only and does not constitute legal counsel. For free legal representation, contact the Legal Aid Society at **0800-70806**.",
      ps: "\n\n⚖️ **قانوني خبرداری:** دا یوازې عام معلومات دي. د وړیا قانوني مرستې لپاره **0800-70806** سره اړیکه ونیسئ.",
    };
    if (!text.includes("0800-70806") && !text.includes("قانونی وضاحت")) {
      return text + (disclaimers[language] ?? disclaimers.ur ?? disclaimers.en);
    }
  }

  if (domain === "welfare") {
    const disclaimers: Partial<Record<Language, string>> & Record<"en", string> = {
      ur: "\n\n📌 **سرکاری اہلیت کی یاد دہانی:** راہی پر اہلیت کا تخمینہ سرکاری قوانین کے مطابق لگایا جاتا ہے، تاہم حتمی امداد اور فنڈز کا فیصلہ متعلقہ ادارہ (BISP/بیت المال) خود کرتا ہے۔",
      en: "\n\n📌 **Official Verification Note:** RAAHI estimates eligibility based on public criteria. Final grant disbursement is subject to official verification by the respective authority.",
      ps: "\n\n📌 **رسمي خبرتیا:** د مرستې وروستۍ پریکړه د اړوندې ادارې لخوا کیږي.",
    };
    if (!text.includes("سرکاری اہلیت کی یاد دہانی") && !text.includes("Official Verification Note")) {
      return text + (disclaimers[language] ?? disclaimers.ur ?? disclaimers.en);
    }
  }

  return text;
}
