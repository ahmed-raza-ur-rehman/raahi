import { health } from "@/lib/api/v1/operations";

// Generated shape: every v1 route file only re-exports its operation (see lib/api/v1/operations.ts).
export const GET = health.handle;
export const OPTIONS = health.preflight;
