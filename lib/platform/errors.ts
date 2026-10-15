/**
 * Error taxonomy for every RAAHI HTTP API.
 *
 * Each error has a stable machine-readable `code` (clients branch on it), an HTTP status and a short title.
 * Responses follow RFC 9457 "Problem Details for HTTP APIs" (`application/problem+json`); the `type` member is a
 * URN (`urn:raahi:problem:<code>`) so it is stable and never a dead link. Messages for 5xx errors are generic on
 * purpose: internals (stack traces, SQL, file paths) must never reach a client. See docs/api/errors.md.
 */

export const ERROR_CATALOG = {
  bad_request: { status: 400, title: "Bad request" },
  invalid_json: { status: 400, title: "The request body is not valid JSON" },
  invalid_parameter: { status: 400, title: "A request parameter is invalid" },
  unknown_parameter: { status: 400, title: "The request has a parameter this endpoint does not accept" },
  invalid_cursor: { status: 400, title: "The pagination cursor is invalid" },
  challenge_invalid: { status: 400, title: "The proof-of-work challenge is invalid, expired or unsolved" },
  validation_failed: { status: 422, title: "The request body failed validation" },
  unauthorized: { status: 401, title: "Authentication is required or the credential is invalid" },
  token_expired: { status: 401, title: "The access token has expired" },
  forbidden: { status: 403, title: "The credential does not allow this operation" },
  origin_not_allowed: { status: 403, title: "Cross-site requests are not allowed for this endpoint" },
  not_found: { status: 404, title: "Not found" },
  method_not_allowed: { status: 405, title: "Method not allowed" },
  payload_too_large: { status: 413, title: "The request body is too large" },
  unsupported_media_type: { status: 415, title: "Send the body as application/json" },
  rate_limited: { status: 429, title: "Too many requests" },
  internal: { status: 500, title: "Internal server error" },
  contract_violation: { status: 500, title: "Internal server error" },
  not_configured: { status: 503, title: "This feature is not enabled on this deployment" },
  unavailable: { status: 503, title: "The service is temporarily unavailable" },
} as const;

export type ErrorCode = keyof typeof ERROR_CATALOG;
export const ERROR_CODES = Object.keys(ERROR_CATALOG) as ErrorCode[];

export interface FieldError {
  /** Dotted path to the offending field, e.g. `answers.advance_fee`; empty for the whole body. */
  path: string;
  /** Short stable code, e.g. `invalid_type`, `too_big`. */
  code: string;
  message: string;
}

export interface ApiErrorOptions {
  headers?: Record<string, string>;
  errors?: FieldError[];
  cause?: unknown;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly errors?: FieldError[];

  constructor(code: ErrorCode, message?: string, options: ApiErrorOptions = {}) {
    super(message ?? ERROR_CATALOG[code].title, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.status = ERROR_CATALOG[code].status;
    this.headers = options.headers ?? {};
    this.errors = options.errors;
  }
}

export const isApiError = (value: unknown): value is ApiError => value instanceof ApiError;
