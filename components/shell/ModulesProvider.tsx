"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { ModuleSummary } from "@/lib/modules/config";

/**
 * The modules this deployment has switched on, for client components.
 *
 * The list is passed down from the server layout, so the first paint already
 * knows what this deployment can do — no fetch, no flicker, and no moment
 * where the home screen offers a module that is switched off.
 *
 * The fetch below is only a fallback, for a component rendered outside that
 * provider.
 */

export type ClientModule = ModuleSummary;

const ModulesContext = createContext<ClientModule[] | undefined>(undefined);

let fetched: ClientModule[] | undefined;

export function ModulesProvider({
  modules,
  children,
}: {
  modules: ClientModule[];
  children: React.ReactNode;
}) {
  // Remembered so a component outside the provider still has something.
  useEffect(() => {
    if (modules.length > 0) fetched = modules;
  }, [modules]);

  const value = useMemo(() => modules, [modules]);
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export interface ModulesState {
  modules: ClientModule[];
  /** False until the list is known, so callers can show a skeleton. */
  ready: boolean;
}

export function useModules(): ModulesState {
  const fromContext = useContext(ModulesContext);
  const [fallback, setFallback] = useState<ClientModule[] | undefined>(fetched);

  useEffect(() => {
    if (fromContext && fromContext.length > 0) return;
    if (fetched) return; // already in state from the initialiser
    let cancelled = false;
    fetch("/api/modules")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((payload: { modules?: ClientModule[] }) => {
        if (!cancelled && payload.modules) {
          fetched = payload.modules;
          setFallback(payload.modules);
        }
      })
      .catch(() => {
        // Showing nothing is better than blocking the screen.
      });
    return () => {
      cancelled = true;
    };
  }, [fromContext]);

  const modules = fromContext && fromContext.length > 0 ? fromContext : (fallback ?? []);
  return { modules, ready: modules.length > 0 };
}
