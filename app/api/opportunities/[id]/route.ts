import { guardLegacy } from "@/lib/platform/legacy";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { appUrl, recommendPrep } from "@/lib/opportunities/ecosystem";
import { buildApplicationPlan, documentChecklist } from "@/lib/opportunities/plan";
import { getOpportunity, prepareOpportunities, relatedOpportunities } from "@/lib/opportunities/store";

async function handleGET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prepareOpportunities();
  const item = getOpportunity(id);
  if (!item) return errorResponse("This opportunity was not found or has expired.", 404);

  const prep = recommendPrep({
    kind: item.kind,
    title: item.title,
    organization: item.organization,
    summary: item.summary,
    tags: item.tags,
    jobType: typeof item.extra?.jobType === "string" ? item.extra.jobType : undefined,
  }).map(({ app, reason }) => ({ id: app.id, name: app.name, nameUr: app.nameUr, url: appUrl(app, "", "opportunity"), tagline: app.tagline, cta: app.cta, boundary: app.boundary, reason }));

  return jsonResponse(
    {
      item,
      related: relatedOpportunities(item, 4),
      plan: item.status === "closed" ? [] : buildApplicationPlan(item),
      checklist: documentChecklist(item),
      prep,
    },
    { cache: true },
  );
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy<{ params: Promise<{ id: string }> }>(handleGET, { name: "getOpportunityLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
