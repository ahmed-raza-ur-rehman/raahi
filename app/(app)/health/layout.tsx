import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Free medical camps & care — RAAHI",
  description: "Find free medical camps, affordable treatment routes, and early warning signs of disease outbreaks.",
  alternates: { canonical: "/health" },
  openGraph: {
    title: "Free medical camps & care — RAAHI",
    description: "Find free medical camps, affordable treatment routes, and early warning signs of disease outbreaks.",
    url: "/health",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
