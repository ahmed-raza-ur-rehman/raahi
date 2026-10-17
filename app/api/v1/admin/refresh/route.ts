import { adminRefresh } from "@/lib/api/v1/operations";

// Generated shape: every v1 route file only re-exports its operation (see lib/api/v1/operations.ts).
export const POST = adminRefresh.handle;
export const OPTIONS = adminRefresh.preflight;

/** Scraping can take a while on a cold start. */
export const maxDuration = 60;
