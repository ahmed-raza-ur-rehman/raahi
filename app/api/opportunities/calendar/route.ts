import { CORS_HEADERS, optionsResponse, parseOpportunityQuery } from "@/lib/opportunities/api";
import { describeQuery, pageUrl, siteOrigin } from "@/lib/opportunities/feeds";
import { buildIcs, type IcsEvent } from "@/lib/opportunities/ics";
import { prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";

/**
 * GET /api/opportunities/calendar?… — every matching listing's deadline as an all-day event. Add the address to Google,
 * Apple or Outlook Calendar ("subscribe from URL") and the deadlines stay up to date. Same filters as /api/opportunities.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = parseOpportunityQuery(url.searchParams);
  await prepareOpportunities();
  const query = { ...parsed, openToPakistan: parsed.openToPakistan ?? true, sort: "deadline" as const, limit: Math.min(parsed.limit ?? 100, 100), offset: 0, deadlineWithinDays: parsed.deadlineWithinDays ?? 180 };
  const origin = siteOrigin(request);

  const events: IcsEvent[] = searchOpportunities(query)
    .items.filter((item) => item.deadline)
    .map((item) => ({
      uid: `${item.id}-deadline`,
      summary: `Deadline: ${item.title}`.slice(0, 120),
      description: `${item.organization ? `${item.organization}. ` : ""}Apply at ${item.url} (listed by ${item.sourceName}). More: ${pageUrl(origin, item)}. Always confirm the deadline on the official page.`,
      date: item.deadline as string,
      url: item.url,
      alarmMinutesBefore: 24 * 60 * 3,
    }));

  const download = url.searchParams.get("download") === "1";
  return new Response(buildIcs(events, `RAAHI deadlines — ${describeQuery(query)}`.slice(0, 80)), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="raahi-deadlines.ics"`,
      "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}

export function OPTIONS() {
  return optionsResponse();
}
