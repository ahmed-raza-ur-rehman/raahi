import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

/**
 * The browser session: an opaque random id in an HttpOnly cookie. It is the ONLY authority for "whose data is this" -
 * ids supplied in request bodies (session, conversation, case) are never trusted on their own.
 *
 * Flags: HttpOnly (scripts cannot read it), SameSite=Lax (not sent on cross-site POSTs), Secure in production
 * (never sent over plain HTTP). A cookie that is not a UUID is ignored and replaced.
 */
export const SESSION_COOKIE = "raahi_session";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isSessionId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

let resolverForTests: (() => string | Promise<string>) | undefined;

/** Tests: act as a particular visitor without a real browser cookie jar. Pass undefined to restore. */
export function setSessionResolverForTests(resolver: (() => string | Promise<string>) | undefined): void {
  resolverForTests = resolver;
}

export async function getSessionId(): Promise<string> {
  if (resolverForTests) return resolverForTests();
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (isSessionId(existing)) return existing.toLowerCase();
  const id = randomUUID();
  store.set(SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 180, path: "/" });
  return id;
}
