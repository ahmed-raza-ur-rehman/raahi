import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Do not advertise the framework in a response header.
  poweredByHeader: false,
  // `RAAHI_STANDALONE=1` (the Docker build) emits a self-contained server; Vercel and `next start` are unaffected.
  ...(process.env.RAAHI_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  // Lets the Arena/e2b live preview load dev assets; ignored in production builds.
  allowedDevOrigins: ["*.e2b.app"],
  async headers() {
    return [
      {
        // The embeddable widget is loaded by other sites (the author's NeuroPrep / MDCAT apps, or anyone's page).
        source: "/embed/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
