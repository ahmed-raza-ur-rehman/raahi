import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Documents & attestation — RAAHI",
  description: "How to obtain every official document in Pakistan, what it costs, how long it takes, and how to get it attested.",
  alternates: { canonical: "/documents" },
  openGraph: {
    title: "Documents & attestation — RAAHI",
    description: "How to obtain every official document in Pakistan, what it costs, how long it takes, and how to get it attested.",
    url: "/documents",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
