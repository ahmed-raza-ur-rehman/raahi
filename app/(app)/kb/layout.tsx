import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Knowledge base — RAAHI",
  description: "Every answer Raahi gives, with its official source and the date it was last verified.",
  alternates: { canonical: "/kb" },
  openGraph: {
    title: "Knowledge base — RAAHI",
    description: "Every answer Raahi gives, with its official source and the date it was last verified.",
    url: "/kb",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
