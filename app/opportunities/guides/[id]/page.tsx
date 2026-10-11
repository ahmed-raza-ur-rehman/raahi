import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GuideDetail from "@/components/opportunities/GuideDetail";
import { getResources } from "@/lib/opportunities/directory";
import { ECOSYSTEM, appUrl } from "@/lib/opportunities/ecosystem";
import { getGuide } from "@/lib/opportunities/guides";
import { prepareOpportunities, searchOpportunities } from "@/lib/opportunities/store";

// Live listings and their "days left" change every day, so this page is rendered per request.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const guide = getGuide(id);
  if (!guide) return { title: "Guide not found", robots: { index: false } };
  const description = `${guide.summary.en} Last reviewed ${guide.reviewed}.`;
  return {
    title: guide.title.en,
    description,
    openGraph: { title: guide.title.en, description, type: "article", siteName: "RAAHI Opportunities" },
    twitter: { card: "summary", title: guide.title.en, description },
  };
}

export default async function GuidePage({ params }: Props) {
  const { id } = await params;
  const guide = getGuide(id);
  if (!guide) notFound();

  const resourceIds = [...new Set([...guide.resourceIds, ...guide.steps.flatMap((step) => step.resourceIds ?? [])])];
  const resources = getResources(resourceIds);

  let live: ReturnType<typeof searchOpportunities> | undefined;
  if (guide.opportunityQuery) {
    await prepareOpportunities();
    live = searchOpportunities({ openToPakistan: true, sort: "relevance", ...guide.opportunityQuery, limit: 4 });
  }
  const apps = (guide.appIds ?? []).map((appId) => ECOSYSTEM.find((app) => app.id === appId)).filter((app) => app !== undefined).map((app) => ({ id: app.id, name: app.name, nameUr: app.nameUr, url: appUrl(app, "", "guide"), tagline: app.tagline, cta: app.cta }));

  return <GuideDetail guide={guide} resources={resources} live={live ? { items: live.items, total: live.total } : undefined} apps={apps} related={(guide.related ?? []).map(getGuide).filter((entry) => entry !== undefined).map((entry) => ({ id: entry.id, emoji: entry.emoji, title: entry.title }))} />;
}
