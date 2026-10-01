import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Allow the sandboxed preview host to load dev assets (never enabled in production builds).
  ...(process.env.NODE_ENV !== "production"
    ? { allowedDevOrigins: ["*.e2b.app", "e2b.app", "*.arena.ai", "*.vercel.app"] }
    : {}),
};

export default nextConfig;
