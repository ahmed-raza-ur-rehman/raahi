import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Blood donors & blood banks — RAAHI",
  description: "Find blood banks and register as a donor, or request blood for someone who needs it now.",
  alternates: { canonical: "/blood" },
  openGraph: {
    title: "Blood donors & blood banks — RAAHI",
    description: "Find blood banks and register as a donor, or request blood for someone who needs it now.",
    url: "/blood",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
