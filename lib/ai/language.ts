import type { Language } from "@/lib/types";

export function detectLanguage(query: string, requested?: Language): Language {
  if (requested) return requested;
  if (/^[\x00-\x7f]*$/.test(query)) return "en";
  if (/[پټږښڅڼۍګ]/.test(query)) return "ps";
  return "ur";
}