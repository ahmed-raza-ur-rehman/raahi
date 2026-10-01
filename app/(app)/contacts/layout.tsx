import type { Metadata } from "next";

/**
 * Page metadata lives here rather than in `page.tsx` because that page is a
 * client component, and metadata can only be exported from a server one.
 */
export const metadata: Metadata = {
  title: "Emergency & helpline numbers — RAAHI",
  description: "Direct phone numbers for rescue, police, health, welfare and disaster authorities in Pakistan.",
  alternates: { canonical: "/contacts" },
  openGraph: {
    title: "Emergency & helpline numbers — RAAHI",
    description: "Direct phone numbers for rescue, police, health, welfare and disaster authorities in Pakistan.",
    url: "/contacts",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
