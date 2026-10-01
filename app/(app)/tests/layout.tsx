import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Tests & preparation — RAAHI",
  description: "Competitive exams, IELTS and admission tests: registration, dates, syllabus and a preparation plan.",
  alternates: { canonical: "/tests" },
  openGraph: {
    title: "Tests & preparation — RAAHI",
    description: "Competitive exams, IELTS and admission tests: registration, dates, syllabus and a preparation plan.",
    url: "/tests",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
