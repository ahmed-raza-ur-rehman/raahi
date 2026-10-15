import { getConfig, type PlatformConfig } from "./config";

/**
 * Structured (JSON-lines) logging with automatic redaction.
 *
 * Rules (docs/operations/observability.md): one JSON object per line on stdout; a `requestId` on every request-scoped
 * line; never log request bodies, search text, credentials, cookies or raw IP addresses. Redaction is a safety net
 * for mistakes, not a licence to log secrets.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "silent";
export type LogFields = Record<string, unknown>;

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SENSITIVE_KEY = /(authorization|cookie|token|secret|password|passwd|api[-_]?key|credential|signature|set-cookie)/i;
const MAX_STRING = 300;
const MAX_DEPTH = 4;

function serializeError(error: Error, depth: number): LogFields {
  return {
    name: error.name,
    message: error.message.slice(0, MAX_STRING),
    stack: error.stack?.split("\n").slice(0, 8).join("\n"),
    cause: error.cause instanceof Error && depth < MAX_DEPTH ? serializeError(error.cause, depth + 1) : undefined,
  };
}

export function sanitize(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return undefined;
  if (value instanceof Error) return serializeError(value, depth);
  if (typeof value === "object") {
    if (seen.has(value)) return "[circular]";
    if (depth >= MAX_DEPTH) return "[truncated]";
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1, seen));
    const out: LogFields = {};
    for (const [key, inner] of Object.entries(value as LogFields).slice(0, 40)) {
      out[key] = SENSITIVE_KEY.test(key) ? "[redacted]" : sanitize(inner, depth + 1, seen);
    }
    return out;
  }
  return String(value);
}

export interface Logger {
  debug(message: string, fields?: LogFields): void;
  info(message: string, fields?: LogFields): void;
  warn(message: string, fields?: LogFields): void;
  error(message: string, fields?: LogFields): void;
  child(fields: LogFields): Logger;
}

export interface LoggerOptions {
  level?: LogLevel | (() => LogLevel);
  sink?: (line: string) => void;
  base?: LogFields;
  now?: () => Date;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`));
  const levelOption = options.level;
  const levelOf: () => LogLevel = typeof levelOption === "function" ? levelOption : () => levelOption ?? "info";
  const now = options.now ?? (() => new Date());
  const base = options.base ?? {};

  const emit = (level: Exclude<LogLevel, "silent">, message: string, fields?: LogFields) => {
    if (ORDER[level] < ORDER[levelOf()]) return;
    const line = { ts: now().toISOString(), level, msg: message.slice(0, MAX_STRING), ...(sanitize({ ...base, ...fields }) as LogFields) };
    try {
      sink(JSON.stringify(line));
    } catch {
      // Logging must never take a request down.
    }
  };

  return {
    debug: (message, fields) => emit("debug", message, fields),
    info: (message, fields) => emit("info", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    error: (message, fields) => emit("error", message, fields),
    child: (fields) => createLogger({ ...options, base: { ...base, ...fields } }),
  };
}

let defaultLogger: Logger | undefined;
let warned = false;

/** The process-wide logger; its level follows the platform configuration. */
export function getLogger(config: PlatformConfig = getConfig()): Logger {
  defaultLogger ??= createLogger({ level: () => getConfig().logLevel });
  if (!warned) {
    warned = true;
    for (const warning of config.warnings) defaultLogger.warn("platform configuration warning", { warning });
  }
  return defaultLogger;
}

/** Tests: swap the process-wide logger (undefined restores the default). */
export function setLoggerForTests(logger: Logger | undefined): void {
  defaultLogger = logger;
  warned = logger !== undefined;
}
