import type { Metadata } from "next";
import ToolsPage from "@/components/opportunities/ToolsPage";

export const metadata: Metadata = {
  title: "Tools",
  description: "Check an offer for scam red flags, find opportunities that fit you, plan around a deadline, and learn how to go abroad safely.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const { tool } = await searchParams;
  return <ToolsPage initialTab={(Array.isArray(tool) ? tool[0] : tool) ?? "scam"} />;
}
