import type { Metadata } from "next";
import GuidesPage from "@/components/opportunities/GuidesPage";
import { CATEGORY_TITLES, GUIDE_CATEGORIES, listGuides, searchGuides, type GuideCategory } from "@/lib/opportunities/guides";

export const metadata: Metadata = {
  title: "Guides",
  description: "Step-by-step guides for what to do after FSc, applying for government jobs, studying or working abroad safely, attesting documents, spotting fake offers and more — in English and Urdu.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = first(params.q).slice(0, 200);
  const requested = first(params.category);
  const category = (GUIDE_CATEGORIES as readonly string[]).includes(requested) ? (requested as GuideCategory) : undefined;

  const guides = searchGuides({ q, category }).map((guide) => ({
    id: guide.id,
    category: guide.category,
    emoji: guide.emoji,
    title: guide.title,
    summary: guide.summary,
    duration: guide.duration,
    steps: guide.steps.length,
    reviewed: guide.reviewed,
  }));
  const matching = searchGuides({ q });
  const categories = GUIDE_CATEGORIES.map((id) => ({ id, emoji: CATEGORY_TITLES[id].emoji, label: { en: CATEGORY_TITLES[id].en, ur: CATEGORY_TITLES[id].ur }, count: matching.filter((guide) => guide.category === id).length })).filter((entry) => entry.count > 0 || entry.id === category);
  return <GuidesPage guides={guides} categories={categories} q={q} category={category ?? ""} total={listGuides().length} />;
}
