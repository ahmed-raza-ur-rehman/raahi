import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OpportunityDetail from "@/components/opportunities/OpportunityDetail";
import { appUrl, recommendPrep } from "@/lib/opportunities/ecosystem";
import { KIND_LABELS } from "@/lib/opportunities/i18n";
import { buildApplicationPlan, documentChecklist } from "@/lib/opportunities/plan";
import { getOpportunity, prepareOpportunities, relatedOpportunities } from "@/lib/opportunities/store";

// Listings change hourly and "days left" depends on today, so never cache this page.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  await prepareOpportunities();
  const item = getOpportunity(id);
  if (!item) return { title: "Listing not found", robots: { index: false } };
  const label = KIND_LABELS[item.kind].en;
  const description = [
    item.summary,
    item.deadline ? `Deadline: ${item.deadline}.` : undefined,
    `${label} listed via ${item.sourceName}.`,
  ].filter(Boolean).join(" ").slice(0, 280);
  return {
    title: item.title,
    description,
    openGraph: { title: item.title, description, type: "article", siteName: "RAAHI Opportunities" },
    twitter: { card: "summary", title: item.title, description },
  };
}

export default async function OpportunityPage({ params }: Props) {
  const { id } = await params;
  await prepareOpportunities();
  const item = getOpportunity(id);
  if (!item) notFound();

  const prep = recommendPrep({
    kind: item.kind,
    title: item.title,
    organization: item.organization,
    summary: item.summary,
    tags: item.tags,
    jobType: typeof item.extra?.jobType === "string" ? item.extra.jobType : undefined,
  }).map(({ app, reason }) => ({ id: app.id, name: app.name, nameUr: app.nameUr, url: appUrl(app, "", "opportunity"), tagline: app.tagline, cta: app.cta, boundary: app.boundary, reason }));

  return (
    <OpportunityDetail
      item={item}
      related={relatedOpportunities(item, 4)}
      plan={item.status === "closed" ? [] : buildApplicationPlan(item)}
      checklist={documentChecklist(item)}
      prep={prep}
    />
  );
}
