import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAAHI | Pakistan's service navigator",
  description: "Verified paths through Pakistan's public, welfare, education, and health services.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ur" dir="rtl" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
