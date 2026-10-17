/**
 * The public address of the site, for places that have no request to read it from (sitemap, robots, scheduled scripts).
 * Set `NEXT_PUBLIC_SITE_URL` to pin it; on Vercel the production domain is picked up automatically.
 */
export function configuredOrigin(env: Record<string, string | undefined> = process.env): string | undefined {
  const clean = (value: string | undefined) => value?.trim().replace(/\/+$/, "");
  const explicit = clean(env.NEXT_PUBLIC_SITE_URL) ?? clean(env.SITE_URL);
  if (explicit) return /^https?:\/\//i.test(explicit) ? explicit : `https://${explicit}`;
  const vercel = clean(env.VERCEL_PROJECT_PRODUCTION_URL) ?? clean(env.VERCEL_URL);
  if (vercel) return `https://${vercel.replace(/^https?:\/\//i, "")}`;
  return undefined;
}

/** `configuredOrigin`, falling back to the local dev server so a URL is always absolute. */
export function originOrLocal(env: Record<string, string | undefined> = process.env): string {
  return configuredOrigin(env) ?? "http://localhost:3000";
}
