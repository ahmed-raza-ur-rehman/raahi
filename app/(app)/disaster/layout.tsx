import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Disaster help & relief — RAAHI",
  description: "What to do before, during and after a disaster in Pakistan, and how to request relief.",
  alternates: { canonical: "/disaster" },
  openGraph: {
    title: "Disaster help & relief — RAAHI",
    description: "What to do before, during and after a disaster in Pakistan, and how to request relief.",
    url: "/disaster",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
