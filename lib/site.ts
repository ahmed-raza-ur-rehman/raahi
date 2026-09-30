/**
 * The public origin of this deployment.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in each environment so sitemaps, canonical URLs
 * and Open Graph tags point at the real domain instead of a guessed one.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://raahi.vercel.app").replace(/\/$/, "");

export const SITE_NAME = "RAAHI";

/** Every public, indexable page. */
export const PUBLIC_ROUTES: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/ask", priority: 0.9, changeFrequency: "weekly" },
  { path: "/scholarships", priority: 0.9, changeFrequency: "weekly" },
  { path: "/documents", priority: 0.9, changeFrequency: "weekly" },
  { path: "/tests", priority: 0.8, changeFrequency: "weekly" },
  { path: "/dates", priority: 0.9, changeFrequency: "daily" },
  { path: "/opportunities", priority: 0.8, changeFrequency: "weekly" },
  { path: "/health", priority: 0.8, changeFrequency: "weekly" },
  { path: "/blood", priority: 0.7, changeFrequency: "weekly" },
  { path: "/disaster", priority: 0.7, changeFrequency: "monthly" },
  { path: "/legal", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contacts", priority: 0.8, changeFrequency: "monthly" },
  { path: "/kb", priority: 0.5, changeFrequency: "weekly" },
];
