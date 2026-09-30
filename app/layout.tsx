import type { Metadata, Viewport } from "next";
import "./globals.css";

import { LanguageProvider } from "@/components/shell/LanguageProvider";
import { SITE_URL } from "@/lib/site";
import { ServiceWorkerBridge } from "@/components/shell/ServiceWorkerBridge";

/**
 * Zoom stays enabled: many of the people Raahi is built for need to enlarge
 * text, and `maximum-scale=1` would silently take that away from them.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6b4f",
};

export const metadata: Metadata = {
  // Without this, canonical and Open Graph URLs stay relative, which crawlers
  // treat as ambiguous.
  metadataBase: new URL(SITE_URL),
  title: "RAAHI — Pakistan's Service Navigator",
  description:
    "RAAHI guides Pakistani citizens to verified government, welfare, health, education and legal services in Urdu, Pashto, Hindko and English.",
  keywords: ["Pakistan", "BISP", "NADRA", "services", "راہی", "scholarship", "welfare", "خدمات"],
  applicationName: "RAAHI",
  openGraph: {
    title: "RAAHI — Pakistan's Service Navigator",
    description: "Find verified routes to welfare, education, health, documentation and disaster services.",
    type: "website",
  },
};

/**
 * Pages are rendered per request so that the Content-Security-Policy nonce
 * generated in `proxy.ts` can be stamped onto the scripts Next emits.
 *
 * The cost is small here and the trade is deliberate: every page is a thin
 * shell whose content is fetched client-side, so we are giving up very little
 * caching to remove `'unsafe-inline'` from the script policy entirely.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ur" dir="rtl">
      <head>
        {/*
          Loaded with display=swap so text renders immediately in a system font
          and upgrades when the webfont lands. Deliberately a <link> rather than
          next/font: next/font makes the *build* depend on reaching Google, and
          we would rather degrade to system fonts than fail a deploy.
          TODO: self-host these two families so we drop the third-party request.
        */}
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" href="/icons/favicon-32.png" sizes="32x32" />
        <link rel="icon" href="/icons/raahi.svg" type="image/svg+xml" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
