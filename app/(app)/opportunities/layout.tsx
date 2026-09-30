import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Jobs, internships & training — RAAHI",
  description: "Verified routes to jobs, internships, training programmes and admissions across Pakistan.",
  alternates: { canonical: "/opportunities" },
  openGraph: {
    title: "Jobs, internships & training — RAAHI",
    description: "Verified routes to jobs, internships, training programmes and admissions across Pakistan.",
    url: "/opportunities",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
