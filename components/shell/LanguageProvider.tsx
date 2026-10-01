"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import { pick, t as translate, isRtl } from "@/lib/i18n";
import type { Language, Localized } from "@/lib/types";

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  dir: "rtl" | "ltr";
  /** Translate a UI dictionary key. */
  t: (key: string) => string;
  /** Resolve a Localized knowledge value. */
  L: (value: Localized | string | undefined) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const STORAGE_KEY = "raahi.language";
const LANGUAGES: readonly Language[] = ["ur", "ps", "hkp", "en"];
const DEFAULT_LANGUAGE: Language = "ur";

function isLanguage(value: string | null): value is Language {
  return value !== null && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * `localStorage` is an external store, so `useSyncExternalStore` is the
 * supported way to read it: the server renders the default language and the
 * client adopts the saved one during hydration, with no mismatch and no
 * setState-in-effect.
 */
function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener("storage", onStoreChange);
  // Fires when another tab changes the language.
  return () => window.removeEventListener("storage", onStoreChange);
}

function getSnapshot(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // Private browsing / storage disabled.
    return DEFAULT_LANGUAGE;
  }
}

function getServerSnapshot(): Language {
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // Keep <html lang|dir> in step with the active language. Writing to the DOM
  // (an external system) is exactly what effects are for.
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = isRtl(language) ? "rtl" : "ltr";
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the in-memory store still switches for this tab.
    }
    // Tell other tabs, and this one, that the store changed.
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      dir: isRtl(language) ? "rtl" : "ltr",
      t: (key: string) => translate(key, language),
      L: (localized: Localized | string | undefined) => pick(localized, language),
    }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    // Fallback keeps any component usable outside the provider.
    return {
      language: DEFAULT_LANGUAGE,
      setLanguage: () => undefined,
      dir: "rtl",
      t: (key: string) => translate(key, DEFAULT_LANGUAGE),
      L: (localized) => pick(localized, DEFAULT_LANGUAGE),
    };
  }
  return context;
}
