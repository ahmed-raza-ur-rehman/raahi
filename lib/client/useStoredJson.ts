"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * Per-key subscriber sets, so writing one key re-renders only the components
 * that read it. `storage` events alone are not enough: they only fire in
 * *other* tabs, never in the tab that made the change.
 */
const listeners = new Map<string, Set<() => void>>();

function subscribeToKey(key: string) {
  return (onStoreChange: () => void) => {
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(onStoreChange);
    return () => {
      set?.delete(onStoreChange);
      if (set && set.size === 0) listeners.delete(key);
    };
  };
}

function notifyKey(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

/**
 * State persisted to `localStorage` as JSON.
 *
 * Uses `useSyncExternalStore` — the supported way to read an external store —
 * so the first client render already has the saved value without an effect,
 * without a hydration mismatch, and without `setState` in an effect body.
 * The snapshot is the raw string, so React sees a stable value between reads.
 */
export function useStoredJson<T>(key: string, fallback: T): [T, (next: T) => void] {
  const subscribe = useMemo(() => subscribeToKey(key), [key]);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(key) ?? "";
    } catch {
      // Storage disabled (private mode, quota, embedded webview).
      return "";
    }
  }, [key]);

  const getServerSnapshot = useCallback(() => "", []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo<T>(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // `fallback` is only read when there is nothing stored.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Persisting failed; the in-memory value below still updates.
      }
      notifyKey(key);
    },
    [key],
  );

  return [value, setValue];
}

/**
 * A stable per-browser id, created on first use and then remembered.
 *
 * `getSnapshot` writes only when the key is missing, which is idempotent, so
 * React calling it more than once is safe.
 */
export function useOrCreateStoredId(key: string, prefix: string): string {
  const subscribe = useMemo(() => subscribeToKey(key), [key]);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return "";
    try {
      let value = window.localStorage.getItem(key);
      if (!value) {
        value = `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        window.localStorage.setItem(key, value);
      }
      return value;
    } catch {
      return "";
    }
  }, [key, prefix]);

  const getServerSnapshot = useCallback(() => "", []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** A collision-free id for client-created objects (message bubbles, etc.). */
let idSequence = 0;
export function nextId(prefix: string): string {
  idSequence += 1;
  return `${prefix}-${idSequence}`;
}

/** Reads a plain string preference from `localStorage` (no JSON parsing). */
export function useStoredString(key: string, fallback: string): [string, (next: string) => void] {
  const subscribe = useMemo(() => subscribeToKey(key), [key]);

  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined") return fallback;
    try {
      return window.localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  }, [key, fallback]);

  const getServerSnapshot = useCallback(() => fallback, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // ignore
      }
      notifyKey(key);
    },
    [key],
  );

  return [value, setValue];
}
