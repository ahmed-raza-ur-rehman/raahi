import { z } from "zod";

/**
 * Typed, validated configuration for the API platform. Everything comes from environment variables so the same
 * build runs on Vercel, in Docker or on a laptop.
 *
 * Failure policy: a bad value NEVER widens access. An unusable secret or key disables the feature that depends on
 * it (device tokens, API keys, admin endpoints) and records a warning; it does not fall back to something weaker,
 * and the warning never contains the secret itself. See docs/security/key-management.md.
 */

export const API_SCOPES = ["read", "tools", "assistant"] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const apiKeyRecord = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{2,23}$/, "id must be 3-24 chars of a-z, 0-9, -"),
    /** SHA-256 (hex) of the key's secret part. The secret itself is never stored. */
    hash: z.string().regex(/^[a-f0-9]{64}$/, "hash must be a 64-char lowercase hex SHA-256"),
    scopes: z.array(z.enum(API_SCOPES)).min(1),
    /** Requests per minute for this key. */
    rpm: z.number().int().min(10).max(6000).default(600),
    label: z.string().max(60).optional(),
  })
  .strict();
export type ApiKeyRecord = z.infer<typeof apiKeyRecord>;

export interface TokenSecret {
  kid: string;
  key: Uint8Array;
}

export interface PlatformConfig {
  env: "production" | "development" | "test";
  siteOrigin?: string;
  /** How many proxy hops (rightmost entries of X-Forwarded-For) are trusted to be honest. 0 = ignore the header. */
  trustedProxies: number;
  /** First entry signs new tokens; all entries verify (key rotation). Empty = device auth disabled. */
  tokenSecrets: TokenSecret[];
  tokenTtlSeconds: number;
  powBits: { base: number; max: number };
  apiKeys: ApiKeyRecord[];
  adminSecret?: string;
  /** Exact origins allowed to make credentialed / mutating cross-origin browser requests. */
  corsOrigins: string[];
  /** Multiplies every rate limit (operations knob; 1 = as designed). */
  rateLimitScale: number;
  validateResponses: boolean;
  logLevel: "debug" | "info" | "warn" | "error" | "silent";
  warnings: string[];
}

type Env = Record<string, string | undefined>;

const SECRET_MIN_BYTES = 32;
const ADMIN_SECRET_MIN_CHARS = 24;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function intFrom(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? clamp(Math.trunc(parsed), min, max) : fallback;
}

function parseTokenSecrets(raw: string | undefined, warnings: string[]): TokenSecret[] {
  if (!raw?.trim()) return [];
  const secrets: TokenSecret[] = [];
  const seen = new Set<string>();
  for (const entry of raw.split(",").map((part) => part.trim()).filter(Boolean)) {
    const separator = entry.indexOf(":");
    const kid = separator > 0 ? entry.slice(0, separator) : "";
    const encoded = separator > 0 ? entry.slice(separator + 1) : "";
    if (!/^[A-Za-z0-9_-]{1,16}$/.test(kid) || seen.has(kid)) {
      warnings.push("RAAHI_TOKEN_SECRETS: an entry has a missing, malformed or duplicate key id and was ignored.");
      continue;
    }
    const key = Buffer.from(encoded, "base64url");
    if (key.length < SECRET_MIN_BYTES) {
      warnings.push(`RAAHI_TOKEN_SECRETS: key "${kid}" is shorter than ${SECRET_MIN_BYTES} bytes and was ignored.`);
      continue;
    }
    seen.add(kid);
    secrets.push({ kid, key: new Uint8Array(key) });
  }
  return secrets;
}

function parseApiKeys(raw: string | undefined, warnings: string[]): ApiKeyRecord[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warnings.push("RAAHI_API_KEYS is not valid JSON; no API keys are active.");
    return [];
  }
  if (!Array.isArray(parsed)) {
    warnings.push("RAAHI_API_KEYS must be a JSON array; no API keys are active.");
    return [];
  }
  const records: ApiKeyRecord[] = [];
  const ids = new Set<string>();
  parsed.forEach((entry, index) => {
    const result = apiKeyRecord.safeParse(entry);
    if (!result.success || ids.has(result.data.id)) {
      warnings.push(`RAAHI_API_KEYS[${index}] is invalid or duplicated and was ignored.`);
      return;
    }
    ids.add(result.data.id);
    records.push(result.data);
  });
  return records;
}

function normaliseOrigin(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost") ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function siteOriginFrom(env: Env): string | undefined {
  const explicit = env.NEXT_PUBLIC_SITE_URL || env.SITE_URL;
  if (explicit) return normaliseOrigin(explicit);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return normaliseOrigin(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return undefined;
}

export function loadConfig(env: Env = process.env): PlatformConfig {
  const warnings: string[] = [];
  const nodeEnv = env.NODE_ENV === "production" ? "production" : env.NODE_ENV === "test" ? "test" : "development";
  const siteOrigin = siteOriginFrom(env);

  const corsOrigins = new Set<string>();
  if (siteOrigin) corsOrigins.add(siteOrigin);
  for (const raw of (env.RAAHI_CORS_ORIGINS ?? "").split(",").map((part) => part.trim()).filter(Boolean)) {
    const origin = normaliseOrigin(raw);
    if (origin) corsOrigins.add(origin);
    else warnings.push("RAAHI_CORS_ORIGINS: an entry is not an https origin and was ignored.");
  }

  const adminCandidate = env.RAAHI_ADMIN_SECRET || env.CRON_SECRET;
  let adminSecret: string | undefined;
  if (adminCandidate) {
    if (adminCandidate.length >= ADMIN_SECRET_MIN_CHARS) adminSecret = adminCandidate;
    else warnings.push(`The admin secret is shorter than ${ADMIN_SECRET_MIN_CHARS} characters; admin endpoints stay disabled.`);
  }

  const base = intFrom(env.RAAHI_POW_BITS, 16, 8, 24);
  const scale = Number(env.RAAHI_RATE_LIMIT_SCALE);
  const level = env.RAAHI_LOG_LEVEL;

  return {
    env: nodeEnv,
    siteOrigin,
    trustedProxies: intFrom(env.RAAHI_TRUSTED_PROXIES, env.VERCEL || nodeEnv === "production" ? 1 : 0, 0, 5),
    tokenSecrets: parseTokenSecrets(env.RAAHI_TOKEN_SECRETS, warnings),
    tokenTtlSeconds: intFrom(env.RAAHI_TOKEN_TTL_SECONDS, 3600, 300, 86_400),
    powBits: { base, max: clamp(base + 6, base, 26) },
    apiKeys: parseApiKeys(env.RAAHI_API_KEYS, warnings),
    adminSecret,
    corsOrigins: [...corsOrigins],
    rateLimitScale: Number.isFinite(scale) && scale > 0 ? clamp(scale, 0.05, 100) : 1,
    validateResponses: env.RAAHI_VALIDATE_RESPONSES ? env.RAAHI_VALIDATE_RESPONSES === "1" : nodeEnv !== "production",
    logLevel: level === "debug" || level === "info" || level === "warn" || level === "error" || level === "silent" ? level : nodeEnv === "test" ? "silent" : "info",
    warnings,
  };
}

let cached: PlatformConfig | undefined;

/** The process-wide configuration (read once). */
export function getConfig(): PlatformConfig {
  cached ??= loadConfig();
  return cached;
}

/** Tests: replace or clear the cached configuration. */
export function setConfigForTests(config: PlatformConfig | undefined): void {
  cached = config;
}
