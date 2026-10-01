import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "More from Raahi — RAAHI",
  description: "Language, privacy and how Raahi sources and verifies its information.",
  alternates: { canonical: "/more" },
  openGraph: {
    title: "More from Raahi — RAAHI",
    description: "Language, privacy and how Raahi sources and verifies its information.",
    url: "/more",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
