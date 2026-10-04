import type { Metadata } from "next";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ur" dir="rtl">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
