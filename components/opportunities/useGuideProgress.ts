"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "raahi-guide-progress-v1";
const listeners = new Set<() => void>();

function readRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "{}";
  } catch {
    return "{}";
  }
}

function parse(raw: string): Record<string, number[]> {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter(([, ticks]) => Array.isArray(ticks)).map(([id, ticks]) => [id, (ticks as unknown[]).filter((n): n is number => Number.isInteger(n))]));
  } catch {
    return {};
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

/** Which checklist items of a guide the person has ticked. Kept in this browser only (localStorage). */
export function useGuideProgress(guideId: string) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "{}");
  const ticked = useMemo(() => new Set(parse(raw)[guideId] ?? []), [raw, guideId]);

  const write = useCallback(
    (next: number[]) => {
      const all = parse(readRaw());
      if (next.length === 0) delete all[guideId];
      else all[guideId] = next;
      try {
        localStorage.setItem(KEY, JSON.stringify(all));
      } catch {
        return; // storage full or disabled — leave things as they were
      }
      listeners.forEach((listener) => listener());
    },
    [guideId],
  );

  const toggle = useCallback(
    (index: number) => {
      const current = new Set(parse(readRaw())[guideId] ?? []);
      if (current.has(index)) current.delete(index);
      else current.add(index);
      write([...current].sort((a, b) => a - b));
    },
    [guideId, write],
  );

  return { ticked, toggle, reset: () => write([]) };
}
