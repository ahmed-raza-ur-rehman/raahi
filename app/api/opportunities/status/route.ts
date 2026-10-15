import { guardLegacy } from "@/lib/platform/legacy";
import { jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { linkHealthCheckedAt } from "@/lib/opportunities/directory";
import { SOURCES } from "@/lib/opportunities/scrapers/sources";
import { getStatus, prepareOpportunities } from "@/lib/opportunities/store";

/** How fresh is the data, which sources worked on the last run, and what terms each source is used under. */
async function handleGET() {
  await prepareOpportunities();
  const status = getStatus();
  return jsonResponse(
    {
      ...status,
      linkHealthCheckedAt: linkHealthCheckedAt(),
      registry: SOURCES.map((source) => ({
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        kind: source.defaultKind,
        scope: source.scope,
        minIntervalMinutes: source.minIntervalMinutes,
        experimental: Boolean(source.experimental),
        attribution: source.attribution,
        terms: source.terms,
        enabled: source.enabled,
      })),
    },
    { cache: true },
  );
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy(handleGET, { name: "statusLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
