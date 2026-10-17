import { ApiError, ERROR_CATALOG, type ErrorCode, type FieldError } from "./errors";

/** RFC 9457 problem document, plus RAAHI's stable `code` and the correlation `requestId`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: ErrorCode;
  detail?: string;
  instance?: string;
  requestId?: string;
  errors?: FieldError[];
}

export const PROBLEM_CONTENT_TYPE = "application/problem+json; charset=utf-8";
export const problemType = (code: ErrorCode): string => `urn:raahi:problem:${code.replaceAll("_", "-")}`;

const GENERIC_5XX_DETAIL = "Something went wrong on our side. Please try again; quote the request id if it keeps happening.";

/**
 * Turn anything thrown into a problem document. Only `ApiError` messages with a 4xx status are exposed; everything
 * else (including unexpected exceptions) becomes a generic 500 so internals cannot leak.
 */
export function toProblem(error: unknown, context: { requestId?: string; instance?: string }): { problem: ProblemDetails; headers: Record<string, string> } {
  const api = error instanceof ApiError ? error : new ApiError("internal", undefined, { cause: error });
  const entry = ERROR_CATALOG[api.code];
  const exposeDetail = api.status < 500;
  const problem: ProblemDetails = {
    type: problemType(api.code),
    title: entry.title,
    status: api.status,
    code: api.code,
    detail: exposeDetail ? api.message : GENERIC_5XX_DETAIL,
    instance: context.instance,
    requestId: context.requestId,
    errors: api.errors && api.errors.length > 0 ? api.errors.slice(0, 20) : undefined,
  };
  return { problem, headers: api.headers };
}
