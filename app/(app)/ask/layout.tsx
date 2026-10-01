import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Ask Raahi — RAAHI",
  description: "Ask any question in Urdu, Pashto, Hindko or English — by voice or typing. Raahi answers from verified official sources.",
  alternates: { canonical: "/ask" },
  openGraph: {
    title: "Ask Raahi — RAAHI",
    description: "Ask any question in Urdu, Pashto, Hindko or English — by voice or typing. Raahi answers from verified official sources.",
    url: "/ask",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
