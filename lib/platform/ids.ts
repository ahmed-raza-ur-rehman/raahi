import { randomBytes, randomUUID } from "node:crypto";

const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/** A new correlation id. */
export const newRequestId = (): string => randomUUID();

/**
 * Accept the caller's `X-Request-Id` only when it is a boring token. Anything else (spaces, newlines, quotes,
 * very long values) is replaced, so a hostile id can never forge or break log lines.
 */
export function requestIdFrom(headers: Headers): string {
  const incoming = headers.get("x-request-id");
  return incoming && REQUEST_ID.test(incoming) ? incoming : newRequestId();
}

export const b64url = {
  encode: (input: Uint8Array | string): string => Buffer.from(input as Uint8Array).toString("base64url"),
  decode: (input: string): Buffer => Buffer.from(input, "base64url"),
};

export const randomToken = (bytes = 16): string => randomBytes(bytes).toString("base64url");
