import { guardLegacy } from "@/lib/platform/legacy";
import { jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { buildPlanner, searchFlagships, summarizeFlagship, type FlagshipRoute } from "@/lib/opportunities/flagships";
import { FUNDING_TYPES, LEVELS, OPPORTUNITY_KINDS, type Funding, type Level, type OpportunityKind } from "@/lib/opportunities/types";
import type { Language } from "@/lib/types";

const ROUTES: readonly FlagshipRoute[] = ["direct", "hec", "embassy", "agency", "university"];
const oneOf = <T extends string>(allowed: readonly T[], value: string | null): T | undefined => (value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined);

/**
 * GET /api/opportunities/flagships?q=&kind=&level=&funding=&route=&lang=en|ur|ps&limit=
 *
 * The yearly planner: programmes that come round every year, with the months they usually open, how to apply from
 * Pakistan, what to prepare, and the dates of the latest call we could confirm (each marked `official` or `reported`).
 * `phase` is computed for today in Pakistan. Results come most-urgent first; `q` understands English, Roman Urdu and Urdu.
 */
async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const lang = params.get("lang");
  const language: Language = lang === "ur" || lang === "ps" ? lang : "en";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 60, 1), 60);

  const entries = searchFlagships({
    q: params.get("q")?.slice(0, 200) || undefined,
    kind: oneOf<OpportunityKind>(OPPORTUNITY_KINDS, params.get("kind")),
    level: oneOf<Level>(LEVELS, params.get("level")),
    funding: oneOf<Funding>(FUNDING_TYPES, params.get("funding")),
    route: oneOf<FlagshipRoute>(ROUTES, params.get("route")),
    limit,
  });
  const planner = buildPlanner();
  return jsonResponse(
    {
      today: planner.today,
      total: entries.length,
      counts: { act: planner.act.length, soon: planner.soon.length, prepare: planner.prepare.length, later: planner.later.length },
      items: entries.map((entry) => summarizeFlagship(entry, language)),
    },
    { cache: true },
  );
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy(handleGET, { name: "flagshipsLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
