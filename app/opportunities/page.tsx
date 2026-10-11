import HubPage from "@/components/opportunities/HubPage";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The URL is the source of truth for filters, so a search link opens exactly the same view for whoever receives it. */
export default async function OpportunitiesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = Array.isArray(value) ? value[0] : value;
    if (first !== undefined) query.set(key, first);
  }
  return <HubPage initialQuery={query.toString()} />;
}
