import { z } from "zod";
import { errorResponse, jsonResponse } from "@/lib/opportunities/api";
import { rankMatches } from "@/lib/opportunities/match";
import { prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";
import { LEVELS, OPPORTUNITY_KINDS, SCOPES } from "@/lib/opportunities/types";

const profileSchema = z.object({
  level: z.enum(LEVELS).optional(),
  fields: z.array(z.string().max(40)).max(8).optional(),
  interests: z.array(z.enum(OPPORTUNITY_KINDS)).max(10).optional(),
  gender: z.enum(["female", "male"]).optional(),
  country: z.string().max(80).optional(),
  scope: z.enum(SCOPES).optional(),
  needsFunding: z.boolean().optional(),
  remoteOk: z.boolean().optional(),
  keywords: z.string().max(200).optional(),
});

/** POST a short profile, get ranked opportunities with the reasons. Nothing is stored. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Send a JSON profile.");
  }
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return errorResponse("The profile is not valid.");

  await prepareOpportunities();
  const profile = parsed.data;
  const candidates = searchOpportunities({
    kinds: profile.interests && profile.interests.length > 0 ? profile.interests : undefined,
    scope: profile.scope,
    openToPakistan: true,
    limit: 100,
  }).items;
  const results = rankMatches(profile, candidates, 12);
  return jsonResponse({ total: results.length, results });
}
