import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { APP_VERSION } from "@/lib/version";

/**
 * Release hygiene, enforced rather than remembered.
 *
 * These are the small promises that quietly rot: a version bumped in one place
 * and not another, an unreleased changelog. Making them tests means a release
 * cannot ship a lie.
 */

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

test("the version in package.json and lib/version.ts agree", () => {
  const packageJson = JSON.parse(read("package.json")) as { version: string };
  assert.equal(
    packageJson.version,
    APP_VERSION,
    "bump BOTH package.json and lib/version.ts (see the release process in CHANGELOG.md)",
  );
});

test("the version is a semantic version", () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/, `${APP_VERSION} should look like 1.0.0`);
});

test("the changelog documents the current version", () => {
  const changelog = read("CHANGELOG.md");
  assert.ok(
    changelog.includes(`## [${APP_VERSION}]`),
    `CHANGELOG.md must have a "## [${APP_VERSION}]" section with the release date`,
  );

  // The newest entry must carry a date - an undated release is not a release.
  const firstEntry = changelog.split("\n## ")[1] ?? "";
  assert.ok(firstEntry.startsWith(`[${APP_VERSION}]`), "the newest changelog entry should be the current version");
  assert.match(firstEntry, /\d{4}-\d{2}-\d{2}/, "and it should say when it shipped");
});

test("the changelog explains how to cut a release", () => {
  assert.match(read("CHANGELOG.md"), /## Release process/);
});

test("the privacy policy is linked from More and indexed", () => {
  const more = read("app/(app)/more/page.tsx");
  assert.match(more, /href="\/privacy"/, "a privacy page nobody can find is not a privacy page");

  const site = read("lib/site.ts");
  assert.match(site, /path: "\/privacy"/, "and it should be in the sitemap");
});

test("secrets cannot be committed by accident", () => {
  // A template is fine; a real .env is not.
  const gitignore = read(".gitignore");
  assert.match(gitignore, /\.env\*/, ".env files must be ignored");
  assert.match(gitignore, /!\/?\.env\.example/, "but the example must stay committed");
});

test("citizen data is never committed", () => {
  const gitignore = read(".gitignore");
  for (const pattern of ["/data/*.db", "/data/*.db-shm", "/data/*.db-wal"]) {
    assert.ok(gitignore.includes(pattern), `.gitignore must ignore ${pattern}`);
  }
});
