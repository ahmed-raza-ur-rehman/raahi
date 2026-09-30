"use client";

import { useCallback, useEffect, useState } from "react";

export interface ApiState<T> {
  data: T | undefined;
  loading: boolean;
  error: string | undefined;
  reload: () => void;
}

interface Settled<T> {
  /** Identifies the exact request this result belongs to (`url#nonce`). */
  key: string;
  data?: T;
  error?: string;
}

/**
 * Tiny data-fetching hook: no dependencies, no stale-closure surprises.
 *
 * `loading` and the returned payload are *derived* from the current request key
 * rather than stored alongside it, so switching `url` can never briefly show the
 * previous URL's data, and `url === null` is never "loading".
 */
export function useApi<T>(url: string | null): ApiState<T> {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | undefined>(undefined);

  useEffect(() => {
    if (!url) return;
    const key = `${url}#${nonce}`;
    let cancelled = false;

    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as T;
      })
      .then((data) => {
        if (!cancelled) setSettled({ key, data });
      })
      .catch(() => {
        if (!cancelled) setSettled({ key, error: "Could not load this right now. Please try again." });
      });

    return () => {
      cancelled = true;
    };
  }, [url, nonce]);

  const key = url ? `${url}#${nonce}` : null;
  const fresh = key !== null && settled?.key === key;

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return {
    data: fresh ? settled?.data : undefined,
    loading: key !== null && !fresh,
    error: fresh ? settled?.error : undefined,
    reload,
  };
}

export async function apiPost<T>(
  url: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) return { ok: false, error: data?.error ?? "Something went wrong." };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "The network is not reachable." };
  }
}
