import type { Metadata } from "next";
import ResourcesPage from "@/components/opportunities/ResourcesPage";

export const metadata: Metadata = {
  title: "Resource directory",
  description: "Official portals and trusted sites for scholarships, jobs, internships, free courses, overseas employment and exam preparation — with provenance for every link.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  return <ResourcesPage initialQ={first(params.q).slice(0, 200)} initialCategory={first(params.category)} />;
}
