import { errorResponse, jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { appUrl, recommendPrep } from "@/lib/opportunities/ecosystem";
import { buildApplicationPlan, documentChecklist } from "@/lib/opportunities/plan";
import { getOpportunity, prepareOpportunities, relatedOpportunities } from "@/lib/opportunities/store";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
