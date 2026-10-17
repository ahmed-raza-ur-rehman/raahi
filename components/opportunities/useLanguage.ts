"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { Language } from "@/lib/types";

const LANGUAGES: Language[] = ["en", "ur", "ps"];
const listeners = new Set<() => void>();

function readCookie(): Language {
  const saved = document.cookie.match(/(?:^|; )raahi-language=([^;]+)/)?.[1] as Language | undefined;
  return saved && LANGUAGES.includes(saved) ? saved : "ur";
}

/** Re-reads the cookie whenever this page or another RAAHI tab/page changes the language. */
function subscribe(callback: () => void) {
  listeners.add(callback);
  const channel = "BroadcastChannel" in window ? new BroadcastChannel("raahi-preferences") : null;
  const onMessage = () => callback();
  channel?.addEventListener("message", onMessage);
  return () => {
    listeners.delete(callback);
    channel?.removeEventListener("message", onMessage);
    channel?.close();
  };
}

/** Same persistence as the home page: `raahi-language` cookie + BroadcastChannel, so every RAAHI page agrees. */
export function useLanguage(): [Language, (language: Language) => void] {
  const language = useSyncExternalStore(subscribe, readCookie, () => "ur" as Language);

  const change = useCallback((next: Language) => {
    document.cookie = `raahi-language=${next}; max-age=31536000; path=/; SameSite=Lax`;
    listeners.forEach((listener) => listener());
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel("raahi-preferences");
      channel.postMessage({ language: next });
      channel.close();
    }
  }, []);

  return [language, change];
}
