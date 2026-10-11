import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Lets the Arena/e2b live preview load dev assets; ignored in production builds.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
