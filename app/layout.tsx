import type { Metadata } from "next";
import { connection } from "next/server";
// Fonts are served from this origin (no request to Google, and a CSP with no third-party font or style source).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "@fontsource/inter/900.css";
import "@fontsource/noto-naskh-arabic/400.css";
import "@fontsource/noto-naskh-arabic/500.css";
import "@fontsource/noto-naskh-arabic/600.css";
import "@fontsource/noto-naskh-arabic/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAAHI — Pakistan's Service Navigator",
  description:
    "RAAHI guides Pakistani citizens to verified government, welfare, health, and education services in Urdu, English, and Pashto.",
  keywords: ["Pakistan", "BISP", "NADRA", "services", "راہی", "welfare", "خدمات"],
  applicationName: "RAAHI",
  openGraph: {
    title: "RAAHI — Pakistan's Service Navigator",
    description: "Find verified routes to welfare, education, health, and documentation services.",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The Content-Security-Policy carries a per-request nonce (proxy.ts), so every page is rendered per request.
  await connection();
  return (
    <html lang="ur" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
