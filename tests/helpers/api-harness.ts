import { randomBytes } from "node:crypto";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { issueDeviceToken } from "@/lib/platform/auth/tokens";
import { setPlatformClock } from "@/lib/platform/clock";
import { loadConfig, setConfigForTests, type PlatformConfig } from "@/lib/platform/config";
import { MemoryRateLimitStore, setRateLimitStore } from "@/lib/platform/limit/store";
import { createLogger, setLoggerForTests } from "@/lib/platform/log";
import { metrics } from "@/lib/platform/metrics";
import { setClock } from "@/lib/opportunities/clock";
import { parseSnapshot } from "@/lib/opportunities/snapshot";
import { loadSnapshotIntoDb } from "@/lib/opportunities/store";

/**
 * Shared bench for the API test layers (contract, security, performance): a real SQLite database loaded with the
 * committed production snapshot at a pinned instant, a fixed platform clock, quiet logs and a fresh rate-limit store.
 * Handlers are exercised through the real route-file exports, i.e. exactly what Next.js calls.
 */

/** "Now" for every API test: the day the committed snapshot was taken. */
export const NOW = new Date("2026-10-15T08:00:00Z");
export const ADMIN_SECRET = "bench-admin-secret-0123456789abcdef";

export interface Bench {
  config: PlatformConfig;
  logLines: string[];
  /** A fresh rate-limit store and metrics registry; call between tests that count requests. */
  reset(): void;
  deviceToken(installId?: string): Promise<string>;
}

export function bootApi(name: string, env: Record<string, string> = {}): Bench {
  process.env.OPPORTUNITIES_BUNDLED = "off";
  process.env.OPPORTUNITIES_SNAPSHOT_URL = "off";
  const dbPath = join(process.cwd(), "data", `raahi.${name}.test.db`);
  for (const suffix of ["", "-wal", "-shm"]) rmSync(dbPath + suffix, { force: true });
  process.env.RAAHI_DB_PATH = dbPath;

  setClock(() => NOW);
  setPlatformClock(() => NOW.getTime());

  const config = loadConfig({
    NODE_ENV: "test",
    RAAHI_TOKEN_SECRETS: `k1:${randomBytes(32).toString("base64url")}`,
    RAAHI_ADMIN_SECRET: ADMIN_SECRET,
    RAAHI_TRUSTED_PROXIES: "1",
    RAAHI_RATE_LIMIT_SCALE: "100",
    RAAHI_POW_BITS: "8",
    ...env,
  });
  setConfigForTests(config);

  const logLines: string[] = [];
  setLoggerForTests(createLogger({ level: "debug", sink: (line) => logLines.push(line) }));

  const { snapshot } = parseSnapshot(JSON.parse(readFileSync(join(process.cwd(), "data", "opportunities", "snapshot.json"), "utf8")));
  loadSnapshotIntoDb(snapshot, NOW);

  const reset = () => {
    setRateLimitStore(new MemoryRateLimitStore());
    metrics.reset();
    logLines.length = 0;
  };
  reset();

  return {
    config,
    logLines,
    reset,
    deviceToken: async (installId = "3f1c2b5e-8d6a-4f0e-9b21-0a7c5d4e6f10") => (await issueDeviceToken(config, { installId, platform: "android" }, Math.floor(NOW.getTime() / 1000))).token,
  };
}

export function req(url: string, init: RequestInit & { ip?: string } = {}): Request {
  const headers = new Headers(init.headers);
  if (init.ip) headers.set("x-forwarded-for", init.ip);
  const { ip: _ip, ...rest } = init;
  void _ip;
  return new Request(new URL(url, "http://localhost"), { ...rest, headers });
}

export const json = (body: unknown, headers: Record<string, string> = {}): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
  headers: { "content-type": "application/json", ...headers },
});

export const ctx = (params: Record<string, string>) => ({ params: Promise.resolve(params) });
