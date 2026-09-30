"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only.
 *
 * In development a service worker would serve stale bundles and fight with
 * hot reloading, so it is skipped entirely there.
 */
export function ServiceWorkerBridge() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // Never register over an insecure connection other than localhost.
    const secure = window.location.protocol === "https:" || window.location.hostname === "localhost";
    if (!secure) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Installing offline support is an enhancement; failing must not
        // break the app or spam the console in browsers that block it.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
