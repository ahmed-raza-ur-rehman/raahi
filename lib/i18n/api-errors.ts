import type { Language, Localized } from "@/lib/types";

import { pick } from "./index";

/**
 * Server error messages, translated for the person who has to read them.
 *
 * The API routes return plain English strings. Two screens showed those
 * strings verbatim, which meant an Urdu speaker hitting a validation error
 * was read a sentence they may not understand — exactly when they most need
 * to know what went wrong.
 *
 * Pashto and Hindko are not listed individually: both fall back to Urdu
 * (`pick`), and Urdu is the shared written language across the regions we
 * serve. Adding a half-remembered Pashto rendering would be worse than the
 * fallback.
 */
const MESSAGES: Record<string, Localized> = {
  "Not found.": { en: "Not found.", ur: "نہیں ملا۔" },
  "Case not found.": { en: "That case could not be found.", ur: "وہ کیس نہیں ملا۔" },
  "Service not found.": { en: "That service could not be found.", ur: "وہ سروس نہیں ملی۔" },
  "Procedure not found.": { en: "That procedure could not be found.", ur: "وہ طریقہ کار نہیں ملا۔" },

  "Text is required.": { en: "Please write something first.", ur: "براہ کرم پہلے کچھ لکھیں۔" },
  "Write something first.": { en: "Please write something first.", ur: "براہ کرم پہلے کچھ لکھیں۔" },
  "A search term is required.": { en: "Type something to search for.", ur: "تلاش کے لیے کچھ لکھیں۔" },
  "Tell Raahi what you need.": { en: "Tell Raahi what you need.", ur: "راہی کو بتائیں کہ آپ کو کیا چاہیے۔" },
  "Please describe what you need.": {
    en: "Please describe what you need.",
    ur: "براہ کرم بتائیں کہ آپ کو کیا چاہیے۔",
  },
  "Please share a little more about what you need.": {
    en: "Please share a little more about what you need.",
    ur: "اپنی ضرورت کے بارے میں تھوڑی اور تفصیل بتائیں۔",
  },
  "Please describe the correction.": {
    en: "Please describe what should be corrected.",
    ur: "براہ کرم بتائیں کہ کیا درست کرنا ہے۔",
  },

  "Please check the request details.": {
    en: "Please check the details you entered.",
    ur: "براہ کرم اپنی درج کردہ تفصیلات چیک کریں۔",
  },
  "Please check the relief request details.": {
    en: "Please check the relief request details.",
    ur: "براہ کرم امدادی درخواست کی تفصیلات چیک کریں۔",
  },
  "Please check the donor details.": {
    en: "Please check the donor details.",
    ur: "براہ کرم عطیہ دہندہ کی تفصیلات چیک کریں۔",
  },

  "The document could not be read. Please try a clearer image.": {
    en: "The document could not be read. Please try a clearer photo.",
    ur: "دستاویز نہیں پڑھی جا سکی۔ براہ کرم صاف تصویر لیں۔",
  },
  "No audio was received.": { en: "No sound was recorded. Please try again.", ur: "آواز ریکارڈ نہیں ہوئی۔ دوبارہ کوشش کریں۔" },

  "That application could not be created.": {
    en: "That application could not be saved. Please try again.",
    ur: "درخواست محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
  },
  "That change could not be applied.": {
    en: "That change could not be saved. Please try again.",
    ur: "یہ تبدیلی محفوظ نہیں ہو سکی۔ دوبارہ کوشش کریں۔",
  },
  "That document update could not be read.": {
    en: "That document update could not be read. Please try again.",
    ur: "دستاویز کی اپ ڈیٹ نہیں پڑھی جا سکی۔ دوبارہ کوشش کریں۔",
  },
  "That profile could not be read.": {
    en: "That profile could not be read. Please try again.",
    ur: "پروفائل نہیں پڑھی جا سکی۔ دوبارہ کوشش کریں۔",
  },
  "That action was not understood.": {
    en: "Raahi did not understand that action. Please try again.",
    ur: "راہی اس عمل کو سمجھ نہیں سکا۔ دوبارہ کوشش کریں۔",
  },
};

/** Used when the server sent something we have not translated. */
const GENERIC: Localized = {
  en: "Something went wrong. Please try again.",
  ur: "کچھ غلط ہو گیا۔ براہ کرم دوبارہ کوشش کریں۔",
};

/**
 * Translate an error returned by the API.
 *
 * Unmapped messages fall back to a generic localised message rather than
 * leaking English: a vague sentence the visitor can read beats a precise one
 * they cannot. The original string is still logged server-side, so nothing is
 * lost for debugging.
 */
export function apiErrorText(message: string | undefined, language: Language = "ur"): string {
  if (!message) return pick(GENERIC, language);
  return pick(MESSAGES[message] ?? GENERIC, language);
}
