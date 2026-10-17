import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Opportunities — RAAHI", template: "%s — RAAHI Opportunities" },
  description:
    "Scholarships, government and overseas jobs, internships, competitions and free courses for Pakistan and abroad — fresh listings with deadlines, plus tools to avoid scams and plan applications.",
  openGraph: { title: "RAAHI Opportunities", description: "Fresh scholarships, jobs, courses and safe routes abroad.", type: "website" },
};

export default function OpportunitiesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
