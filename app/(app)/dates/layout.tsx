import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Important dates & deadlines — RAAHI",
  description: "Exam, admission, job and scholarship deadlines with a countdown, each linked to its official source.",
  alternates: { canonical: "/dates" },
  openGraph: {
    title: "Important dates & deadlines — RAAHI",
    description: "Exam, admission, job and scholarship deadlines with a countdown, each linked to its official source.",
    url: "/dates",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
