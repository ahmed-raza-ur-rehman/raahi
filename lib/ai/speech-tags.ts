import type { Language } from "@/lib/types";

/**
 * Language tags for speech, kept in their own leaf module on purpose.
 *
 * `lib/ai/voice.ts` imports the model SDK, and the voice button in the header
 * is a client component. Importing these four lines from there would silently
 * ship the whole SDK to every visitor's phone - which is exactly what was
 * happening before this file existed.
 *
 * Anything the browser needs must live here, with no server-only imports.
 */

export const SPEECH_TAGS: Record<Language, { speech: string; tts: string; label: string }> = {
  en: { speech: "en-PK", tts: "en-GB", label: "English" },
  ur: { speech: "ur-PK", tts: "ur-PK", label: "اردو" },
  ps: { speech: "ps-AF", tts: "ps-AF", label: "پښتو" },
  hkp: { speech: "ur-PK", tts: "ur-PK", label: "ہندکو (اردو رسم الخط)" },
};

/** Languages whose script is written right-to-left, for UI layout. */
export function isRtlLanguage(language: Language): boolean {
  return language !== "en";
}
