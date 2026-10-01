import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Legal guidance — RAAHI",
  description: "Plain-language guidance on common legal problems in Pakistan, and who to contact for help.",
  alternates: { canonical: "/legal" },
  openGraph: {
    title: "Legal guidance — RAAHI",
    description: "Plain-language guidance on common legal problems in Pakistan, and who to contact for help.",
    url: "/legal",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
