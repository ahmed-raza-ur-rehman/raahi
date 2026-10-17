"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import type { OpportunityKind } from "@/lib/opportunities/types";

export interface SavedItem {
  id: string;
  title: string;
  kind: OpportunityKind;
  organization?: string;
  deadline?: string;
  url: string;
  sourceName: string;
  savedAt: string;
}

const KEY = "raahi-saved-opportunities-v1";
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): SavedItem[] {
  try {
    const parsed = JSON.parse(raw) as SavedItem[];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

/** Bookmarks live only in this browser (localStorage) — nothing is sent anywhere. */
export function useSaved() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const saved = useMemo(() => parse(raw), [raw]);

  const toggle = useCallback((item: Omit<SavedItem, "savedAt">) => {
    const current = parse(readRaw());
    const next = current.some((entry) => entry.id === item.id)
      ? current.filter((entry) => entry.id !== item.id)
      : [{ ...item, savedAt: new Date().toISOString() }, ...current].slice(0, 100);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      return; // storage full or disabled — leave the list unchanged
    }
    listeners.forEach((listener) => listener());
  }, []);

  const isSaved = useCallback((id: string) => saved.some((entry) => entry.id === id), [saved]);
  return { saved, toggle, isSaved };
}
