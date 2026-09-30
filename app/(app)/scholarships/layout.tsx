import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Scholarships & grants — RAAHI",
  description: "National and international scholarships with fees, eligibility, required documents and the application procedure, step by step.",
  alternates: { canonical: "/scholarships" },
  openGraph: {
    title: "Scholarships & grants — RAAHI",
    description: "National and international scholarships with fees, eligibility, required documents and the application procedure, step by step.",
    url: "/scholarships",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
