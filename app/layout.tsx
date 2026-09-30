import type { Metadata, Viewport } from "next";
import "./globals.css";

import { LanguageProvider } from "@/components/shell/LanguageProvider";

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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
