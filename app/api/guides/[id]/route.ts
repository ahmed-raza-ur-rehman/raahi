import { guardLegacy } from "@/lib/platform/legacy";
import { errorResponse, jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { getResources } from "@/lib/opportunities/directory";
import { getGuide } from "@/lib/opportunities/guides";

/** GET /api/guides/:id — the whole guide in English and Urdu, with the directory entries it links to. */
async function handleGET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const guide = getGuide(id);
  if (!guide) return errorResponse("Guide not found", 404);
  const ids = [...new Set([...guide.resourceIds, ...guide.steps.flatMap((step) => step.resourceIds ?? [])])];
  return jsonResponse(
    {
      ...guide,
      url: `/opportunities/guides/${guide.id}`,
      resources: getResources(ids).map(({ id: resourceId, name, nameUr, url, authority, category, health }) => ({ id: resourceId, name, nameUr, url, authority, category, linkVerdict: health?.verdict })),
      disclaimer: "Rules, fees and dates change. Confirm on the official page before you act or pay.",
    },
    { cache: true },
  );
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy<{ params: Promise<{ id: string }> }>(handleGET, { name: "guideLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
