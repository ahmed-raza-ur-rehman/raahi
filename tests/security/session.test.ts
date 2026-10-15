import assert from "node:assert/strict";
import test from "node:test";
import { SESSION_COOKIE, isSessionId, sessionIdFrom, type CookieStoreLike } from "@/lib/web/session";

function jar(initial?: string) {
  const sets: Array<{ name: string; value: string; options: Parameters<CookieStoreLike["set"]>[2] }> = [];
  const store: CookieStoreLike = {
    get: (name) => (name === SESSION_COOKIE && initial !== undefined ? { value: initial } : undefined),
    set: (name, value, options) => {
      sets.push({ name, value, options });
    },
  };
  return { store, sets };
}

test("REQ-SEC-017 a new visitor gets a random UUID in an HttpOnly, SameSite=Lax cookie that is Secure in production", () => {
  const production = jar();
  const id = sessionIdFrom(production.store, "production");
  assert.ok(isSessionId(id));
  assert.equal(production.sets.length, 1);
  assert.deepEqual(production.sets[0].options, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 15_552_000, path: "/" });
  assert.equal(production.sets[0].value, id);

  const development = jar();
  sessionIdFrom(development.store, "development");
  assert.equal(development.sets[0].options.secure, false, "plain-HTTP localhost development must still work");
  assert.notEqual(sessionIdFrom(jar().store, "production"), id, "ids are random");
});

test("REQ-SEC-017 an existing valid cookie is reused (normalised to lower case) and not rewritten", () => {
  const mixed = "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE";
  const { store, sets } = jar(mixed);
  assert.equal(sessionIdFrom(store, "production"), mixed.toLowerCase());
  assert.equal(sets.length, 0);
});

test("REQ-SEC-017 a malformed or hostile cookie value is ignored and replaced, never trusted or stored", () => {
  for (const hostile of ["", "short", "../../etc/passwd", "'; DROP TABLE cases;--", "<script>alert(1)</script>", "x".repeat(500), "00000000-0000-0000-0000-00000000000g", "session-123-abcdef"]) {
    const { store, sets } = jar(hostile);
    const id = sessionIdFrom(store, "production");
    assert.ok(isSessionId(id), `value ${JSON.stringify(hostile.slice(0, 30))} must be replaced`);
    assert.notEqual(id, hostile);
    assert.equal(sets.length, 1);
  }
  assert.equal(isSessionId(undefined), false);
  assert.equal(isSessionId(42), false);
});
