import type { Language } from "@/lib/types";

/**
 * Script-based language detection.
 *
 * Urdu and Hindko share the Arabic script, so they cannot be distinguished
 * reliably from text alone. Hindko is only selected when the user explicitly
 * picks it, and otherwise falls back to Urdu — the correct, readable choice for
 * a Hindko speaker in Pakistan.
 */
export function detectLanguage(query: string, requested?: Language): Language {
  if (requested) return requested;
  const value = (query ?? "").trim();
  if (value.length === 0) return "ur";
  // Pashto-specific letters: ټ ځ څ ډ ړ ږ ښ ګ ڼ ۍ پ (پ appears in Pashto-only clusters)
  if (/[ټځڅډړږښګڼۍ]/.test(value)) return "ps";
  if (/^[\x00-\x7f]*$/.test(value)) return "en";
  return "ur";
}

export function detectScript(query: string): "latin" | "arabic" {
  return /^[\x00-\x7f]*$/.test(query ?? "") ? "latin" : "arabic";
}
