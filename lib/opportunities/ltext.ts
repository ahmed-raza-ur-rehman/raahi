import type { Language } from "@/lib/types";

/** Text in the languages RAAHI speaks. Pashto falls back to Urdu, then English, like the rest of the hub. */
export interface LText {
  en: string;
  ur: string;
  ps?: string;
}

export function pickText(language: Language, value: LText): string {
  if (language === "ps") return value.ps ?? value.ur ?? value.en;
  return language === "ur" ? value.ur : value.en;
}
