import type { Metadata } from "next";
import "./globals.css";

import { LanguageProvider } from "@/components/shell/LanguageProvider";

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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
