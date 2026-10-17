import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import YAML from "yaml";

const root = process.cwd();
const workflowDir = join(root, ".github", "workflows");
const workflows = existsSync(workflowDir) ? readdirSync(workflowDir).filter((name) => /\.ya?ml$/.test(name)) : [];

test("REQ-SEC-019 every third-party GitHub Action is pinned to a full commit SHA (a tag can be moved by its owner)", () => {
  assert.ok(workflows.length >= 4);
  const unpinned: string[] = [];
  for (const name of workflows) {
    for (const [index, line] of readFileSync(join(workflowDir, name), "utf8").split("\n").entries()) {
      const match = /^\s*(?:-\s+)?uses:\s*([^\s#]+)/.exec(line);
      if (!match || match[1].startsWith("./")) continue;
      if (!/@[0-9a-f]{40}$/.test(match[1])) unpinned.push(`${name}:${index + 1} ${match[1]}`);
    }
  }
  assert.deepEqual(unpinned, [], "pin with `uses: owner/repo@<40-hex sha> # vX.Y.Z`");
});

test("REQ-SEC-019 workflows follow least privilege: declared permissions, no pull_request_target, no injectable expressions", () => {
  for (const name of workflows) {
    const text = readFileSync(join(workflowDir, name), "utf8");
    const parsed = YAML.parse(text) as { permissions?: unknown; on?: unknown; jobs?: Record<string, { permissions?: unknown }> };
    const jobPermissions = Object.values(parsed.jobs ?? {}).every((job) => job.permissions !== undefined);
    assert.ok(parsed.permissions !== undefined || jobPermissions, `${name}: declare top-level (or per-job) permissions`);
    assert.ok(!/pull_request_target/.test(text), `${name}: pull_request_target runs untrusted code with secrets`);
    assert.ok(!/secrets:\s*inherit/.test(text), `${name}: do not pass every secret to a called workflow`);
    assert.ok(!/\$\{\{\s*github\.(head_ref|event\.(pull_request\.(title|body|head\.(ref|label))|issue\.(title|body)|comment\.body|head_commit\.message))/.test(text), `${name}: attacker-controlled expression in a workflow (script injection)`);
  }
  const selfHosted = workflows.filter((name) => /runs-on:[^\n]*self-hosted|pakistan/.test(readFileSync(join(workflowDir, name), "utf8")));
  for (const name of selfHosted) {
    const on = JSON.stringify((YAML.parse(readFileSync(join(workflowDir, name), "utf8")) as { on: unknown }).on);
    assert.ok(!/pull_request/.test(on), `${name}: a self-hosted runner must never run code from pull requests`);
  }
});

test("REQ-SEC-019 dependency updates are automated for every ecosystem in the repository", () => {
  const dependabot = YAML.parse(readFileSync(join(root, ".github", "dependabot.yml"), "utf8")) as { updates: Array<{ "package-ecosystem": string; directory: string; schedule: { interval: string } }> };
  const ecosystems = new Set(dependabot.updates.map((update) => update["package-ecosystem"]));
  for (const needed of ["npm", "github-actions", "gradle", "docker"]) assert.ok(ecosystems.has(needed), `dependabot must cover ${needed}`);
  assert.ok(dependabot.updates.every((update) => ["daily", "weekly", "monthly"].includes(update.schedule.interval)));
});

test("REQ-SEC-019 installs are reproducible: lockfile present, Gradle distribution checksum pinned and validated", () => {
  assert.ok(existsSync(join(root, "package-lock.json")));
  const wrapper = readFileSync(join(root, "android", "gradle", "wrapper", "gradle-wrapper.properties"), "utf8");
  assert.match(wrapper, /^distributionSha256Sum=[0-9a-f]{64}$/m);
  assert.match(wrapper, /^validateDistributionUrl=true$/m);
  assert.match(wrapper, /distributionUrl=https\\:\/\/services\.gradle\.org\//);
  const ci = readFileSync(join(workflowDir, "ci.yml"), "utf8");
  assert.match(ci, /npm ci/);
  assert.doesNotMatch(ci, /npm install(?!\s+-g)/, "CI must install from the lockfile");
});

test("REQ-SEC-020 secrets stay out of the repository: ignore rules cover key material and no tracked file contains one", () => {
  const ignore = readFileSync(join(root, ".gitignore"), "utf8");
  assert.match(ignore, /^\.env\*$/m);
  assert.match(ignore, /^\*\.pem$/m);
  const androidIgnore = readFileSync(join(root, "android", ".gitignore"), "utf8");
  assert.match(androidIgnore, /\*\.jks/);
  assert.match(androidIgnore, /\*\.keystore/);

  const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).split("\0").filter(Boolean);
  assert.ok(tracked.length > 200);
  assert.ok(!tracked.some((file) => /(^|\/)\.env(\.|$)/.test(file) && !file.endsWith(".example")), "an environment file is tracked");
  const patterns: Array<[string, RegExp]> = [
    ["private key", /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/],
    ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
    ["GitHub token", /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{60,}\b/],
    ["Slack token", /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/],
    ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
    ["OpenAI-style key", /\bsk-[A-Za-z0-9]{32,}\b/],
    ["RAAHI API key", /\brk\.[a-z0-9][a-z0-9-]{2,23}\.[A-Za-z0-9_-]{43}\b/],
    ["Telegram bot token", /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/],
  ];
  const findings: string[] = [];
  for (const file of tracked) {
    const path = join(root, file);
    if (!existsSync(path) || statSync(path).size > 1_500_000 || /\.(png|jpg|jpeg|webp|ico|woff2?|jar|apk|lock|zip)$/.test(file) || file === "package-lock.json") continue;
    const text = readFileSync(path, "utf8");
    for (const [label, pattern] of patterns) if (pattern.test(text)) findings.push(`${file}: looks like a ${label}`);
  }
  assert.deepEqual(findings, []);
});
