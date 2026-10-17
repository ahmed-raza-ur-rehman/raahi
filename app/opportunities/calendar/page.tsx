import type { Metadata } from "next";
import CalendarPage, { type DeadlineRow } from "@/components/opportunities/CalendarPage";
import { buildPlanner, searchFlagships } from "@/lib/opportunities/flagships";
import { getGuide } from "@/lib/opportunities/guides";
import type { LText } from "@/lib/opportunities/ltext";
import { searchOpportunities, prepareOpportunities } from "@/lib/opportunities/store";
import { OPPORTUNITY_KINDS, type OpportunityKind } from "@/lib/opportunities/types";

// "Open now", "closes in 5 days" and the deadline list all depend on today's date, so this page is never cached.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Year planner & deadlines",
  description:
    "Scholarships, exams and programmes that come round every year — when they usually open, how to apply from Pakistan, what to prepare — plus every dated listing closing in the next 60 days.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab = first(params.tab) === "deadlines" ? "deadlines" : "planner";
  const q = first(params.q).slice(0, 200);
  const requestedKind = first(params.kind);
  const kind = (OPPORTUNITY_KINDS as readonly string[]).includes(requestedKind) ? (requestedKind as OpportunityKind) : undefined;

  const planner = buildPlanner();
  const matching = searchFlagships({ q: q || undefined, kind });
  const ids = new Set(matching.map((entry) => entry.flagship.id));
  const section = (entries: typeof planner.act) => entries.filter((entry) => ids.has(entry.flagship.id));

  const guideTitles: Record<string, LText> = {};
  for (const entry of matching) {
    for (const id of entry.flagship.guides ?? []) {
      const guide = getGuide(id);
      if (guide) guideTitles[id] = guide.title;
    }
  }

  let deadlines: DeadlineRow[] = [];
  if (tab === "deadlines") {
    await prepareOpportunities();
    const result = searchOpportunities({ kinds: kind ? [kind] : undefined, deadlineWithinDays: 60, sort: "deadline", limit: 150 });
    deadlines = result.items
      .filter((item) => item.deadline && item.daysLeft !== null && item.daysLeft >= 0)
      .map((item) => ({
        id: item.id,
        title: item.title,
        kind: item.kind,
        organization: item.organization,
        country: item.country,
        deadline: item.deadline as string,
        daysLeft: item.daysLeft as number,
        sourceName: item.sourceName,
        openToPakistan: item.openToPakistan ?? null,
      }));
  }

  return (
    <CalendarPage
      tab={tab}
      q={q}
      kind={kind ?? ""}
      today={planner.today}
      month={planner.month}
      sections={{ act: section(planner.act), soon: section(planner.soon), prepare: section(planner.prepare), later: section(planner.later) }}
      total={planner.act.length + planner.soon.length + planner.prepare.length + planner.later.length}
      deadlines={deadlines}
      guideTitles={guideTitles}
    />
  );
}
