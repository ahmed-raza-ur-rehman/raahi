"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { pick, t as translate } from "@/lib/i18n";
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

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("ur");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (stored === "ur" || stored === "ps" || stored === "hkp" || stored === "en") {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    }
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      dir: language === "en" ? "ltr" : "rtl",
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
      language: "ur",
      setLanguage: () => undefined,
      dir: "rtl",
      t: (key: string) => translate(key, "ur"),
      L: (localized) => pick(localized, "ur"),
    };
  }
  return context;
}
