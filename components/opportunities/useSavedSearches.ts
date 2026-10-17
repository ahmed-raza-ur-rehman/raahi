"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

export interface SavedSearch {
  id: string;
  name: string;
  /** URL query string of the search, without `limit`. */
  query: string;
  createdAt: string;
  /** The last time the person opened this search — everything RAAHI first saw after it counts as new. */
  seenAt: string;
}

export const MAX_SAVED_SEARCHES = 8;
const KEY = "raahi-saved-searches-v1";
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parse(raw: string): SavedSearch[] {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value
      .filter((entry): entry is SavedSearch => Boolean(entry) && typeof entry.id === "string" && typeof entry.query === "string" && typeof entry.seenAt === "string" && !Number.isNaN(Date.parse(entry.seenAt)))
      .slice(0, MAX_SAVED_SEARCHES);
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

function write(next: SavedSearch[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(next.slice(0, MAX_SAVED_SEARCHES)));
  } catch {
    return false; // storage full or disabled — leave the list as it was
  }
  listeners.forEach((listener) => listener());
  return true;
}

/** Saved searches live only in this browser (localStorage) — nothing about them is sent anywhere except the search itself. */
export function useSavedSearches() {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const searches = useMemo(() => parse(raw), [raw]);

  const save = useCallback((name: string, query: string): boolean => {
    const current = parse(readRaw());
    if (current.length >= MAX_SAVED_SEARCHES && !current.some((entry) => entry.query === query)) return false;
    const now = new Date().toISOString();
    const existing = current.find((entry) => entry.query === query);
    const next = existing
      ? current.map((entry) => (entry.id === existing.id ? { ...entry, name: name || entry.name, seenAt: now } : entry))
      : [...current, { id: `s${Date.now().toString(36)}`, name: name || "Saved search", query, createdAt: now, seenAt: now }];
    return write(next);
  }, []);

  const remove = useCallback((id: string) => void write(parse(readRaw()).filter((entry) => entry.id !== id)), []);
  const markSeen = useCallback((id: string) => void write(parse(readRaw()).map((entry) => (entry.id === id ? { ...entry, seenAt: new Date().toISOString() } : entry))), []);
  return { searches, save, remove, markSeen };
}

/** How many listings each saved search has gained since it was last opened (one small request per search). */
export function useNewCounts(searches: SavedSearch[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const signature = searches.map((entry) => `${entry.id}|${entry.query}|${entry.seenAt}`).join("\n");

  useEffect(() => {
    if (!signature) return;
    const controller = new AbortController();
    for (const entry of searches) {
      const params = new URLSearchParams(entry.query);
      params.set("since", entry.seenAt);
      params.set("limit", "1");
      fetch(`/api/opportunities?${params.toString()}`, { signal: controller.signal })
        .then((response) => (response.ok ? (response.json() as Promise<{ total: number }>) : null))
        .then((json) => {
          if (json) setCounts((current) => ({ ...current, [entry.id]: json.total }));
        })
        .catch(() => undefined);
    }
    return () => controller.abort();
    // `signature` captures everything about `searches` that matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return counts;
}
