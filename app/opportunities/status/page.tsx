import type { Metadata } from "next";
import StatusPage from "@/components/opportunities/StatusPage";

export const metadata: Metadata = {
  title: "Data status",
  description: "How fresh RAAHI's opportunity listings are, which sources worked on the last refresh, and the terms each source is used under.",
};

export default function Page() {
  return <StatusPage />;
}
