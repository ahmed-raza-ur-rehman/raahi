import { guardLegacy } from "@/lib/platform/legacy";
import { CORS_HEADERS, errorResponse } from "@/lib/opportunities/api";
import { buildIcs, type IcsEvent } from "@/lib/opportunities/ics";
import { buildApplicationPlan } from "@/lib/opportunities/plan";
import { getOpportunity, prepareOpportunities } from "@/lib/opportunities/store";
import { slugify } from "@/lib/opportunities/text";

/** GET /api/opportunities/:id/calendar[?plan=1] → an .ics file with the deadline (and, optionally, each planned step). */
async function handleGET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prepareOpportunities();
  const item = getOpportunity(id);
  if (!item) return errorResponse("This opportunity was not found or has expired.", 404);
  if (!item.deadline) return errorResponse("This opportunity has no fixed deadline to add to a calendar.", 404);

  const events: IcsEvent[] = [
    { uid: `${item.id}-deadline`, summary: `Deadline: ${item.title}`, description: `${item.organization ? `${item.organization}. ` : ""}Apply at ${item.url} (listed by ${item.sourceName}). Always confirm the deadline on the official page.`, date: item.deadline, url: item.url, alarmMinutesBefore: 24 * 60 * 3 },
  ];
  if (new URL(request.url).searchParams.get("plan") === "1") {
    for (const step of buildApplicationPlan(item)) {
      if (step.due && step.id !== "submit" && step.due !== item.deadline) events.push({ uid: `${item.id}-${step.id}`, summary: `${item.title}: ${step.en}`.slice(0, 120), date: step.due, url: item.url });
    }
  }

  return new Response(buildIcs(events, `RAAHI — ${item.title}`.slice(0, 80)), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="raahi-${slugify(item.title) || "deadline"}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy<{ params: Promise<{ id: string }> }>(handleGET, { name: "itemCalendarLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
