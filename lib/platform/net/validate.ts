import type { z } from "zod";
import { ApiError, type FieldError } from "../errors";

/**
 * Strict input parsing shared by every operation.
 *
 *  - Query strings: a parameter given twice is rejected (HTTP parameter pollution); unknown parameters are rejected
 *    (typos surface immediately and nothing unexpected reaches the handler); total length is capped.
 *  - Errors list the offending field paths and codes, never the submitted values.
 */

const MAX_QUERY_LENGTH = 2048;

const safeName = (value: unknown): string => String(value).replace(/[^\w.[\]-]/g, "_").slice(0, 40);

export function issuesToFieldErrors(issues: readonly z.core.$ZodIssue[]): FieldError[] {
  const out: FieldError[] = [];
  for (const issue of issues) {
    const base = issue.path.map(safeName);
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) out.push({ path: [...base, safeName(key)].join("."), code: "unrecognized_key", message: "This field is not accepted." });
    } else {
      out.push({ path: base.join("."), code: issue.code, message: issue.message.slice(0, 200) });
    }
  }
  return out;
}

function fail(kind: "query" | "params" | "body", error: z.ZodError): never {
  const errors = issuesToFieldErrors(error.issues);
  const onlyUnknown = errors.length > 0 && errors.every((entry) => entry.code === "unrecognized_key");
  const first = errors[0];
  const summary = first ? `${first.path ? `${first.path}: ` : ""}${first.message}` : "The request is not valid.";
  if (kind === "body") throw new ApiError("validation_failed", summary, { errors });
  throw new ApiError(onlyUnknown ? "unknown_parameter" : "invalid_parameter", summary, { errors });
}

export function parseQuery<S extends z.ZodType>(schema: S, params: URLSearchParams): z.output<S> {
  if (params.toString().length > MAX_QUERY_LENGTH) throw new ApiError("invalid_parameter", "The query string is too long.");
  const raw = Object.create(null) as Record<string, string>;
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    if (values.length > 1) {
      throw new ApiError("invalid_parameter", `Parameter "${safeName(key)}" may be given only once.`, {
        errors: [{ path: safeName(key), code: "duplicate", message: "This parameter was given more than once." }],
      });
    }
    raw[key] = values[0];
  }
  const result = schema.safeParse(raw);
  if (!result.success) fail("query", result.error);
  return result.data;
}

export function parsePathParams<S extends z.ZodType>(schema: S, params: Record<string, unknown>): z.output<S> {
  const result = schema.safeParse(params);
  if (!result.success) fail("params", result.error);
  return result.data;
}

export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  const result = schema.safeParse(body);
  if (!result.success) fail("body", result.error);
  return result.data;
}
