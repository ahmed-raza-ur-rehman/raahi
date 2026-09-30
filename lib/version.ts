/**
 * The single source of truth for what build this is.
 *
 * An operator debugging a report from the field needs to know exactly which
 * code is running, so the version is exposed through the health endpoint and
 * the footer rather than only living in `package.json`.
 *
 * `tests/release.test.ts` keeps this in step with `package.json`, so bumping
 * one without the other fails the build rather than shipping a lie.
 */
export const APP_VERSION = "1.0.1";

/** Human-readable name for the release, shown in the footer. */
export const APP_NAME = "RAAHI";

/**
 * Where this build came from. Set by the host at build time (Vercel, GitHub
 * Actions and most CI systems provide a commit sha); empty when unknown, which
 * is fine — the version alone is usually enough to identify a release.
 */
export const BUILD_COMMIT = process.env.RAAHI_BUILD_COMMIT ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "";

/** Short sha for display, or "" when the host did not tell us. */
export const BUILD_COMMIT_SHORT = BUILD_COMMIT ? BUILD_COMMIT.slice(0, 7) : "";
