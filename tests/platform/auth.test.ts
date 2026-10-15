import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test from "node:test";
import { SignJWT } from "jose";
import { generateApiKey, hashSecret, secretsMatch, verifyApiKey } from "@/lib/platform/auth/api-keys";
import { authenticate } from "@/lib/platform/auth/authenticate";
import { DifficultyController, ReplayGuard, issueChallenge, leadingZeroBits, powDigest, solveChallenge, verifySolution } from "@/lib/platform/auth/pow";
import { TOKEN_AUDIENCE, TOKEN_ISSUER, issueDeviceToken, verifyDeviceToken } from "@/lib/platform/auth/tokens";
import { loadConfig } from "@/lib/platform/config";
import { ApiError } from "@/lib/platform/errors";
import { b64url } from "@/lib/platform/ids";

const secret = (kid: string) => ({ kid, key: new Uint8Array(randomBytes(32)) });
const NOW = 1_800_000_000;

const rejects = async (promise: Promise<unknown>, code: string) =>
  assert.rejects(promise, (error: unknown) => error instanceof ApiError && error.code === code, `expected ApiError ${code}`);

test("[REQ-SEC-003] a device token round-trips with the claims the server put in it", async () => {
  const config = { tokenSecrets: [secret("k1")], tokenTtlSeconds: 3600 };
  const issued = await issueDeviceToken(config, { installId: "5f0e7e0e-0000-4000-8000-000000000001", platform: "android" }, NOW);
  assert.equal(issued.tokenType, "Bearer");
  assert.equal(issued.expiresIn, 3600);
  const claims = await verifyDeviceToken(config, issued.token, NOW + 10);
  assert.equal(claims.sub, "5f0e7e0e-0000-4000-8000-000000000001");
  assert.deepEqual(claims.scopes, ["read", "tools", "assistant"]);
  assert.equal(claims.platform, "android");
  assert.equal(claims.exp, NOW + 3600);
});

test("[REQ-SEC-003] expired, not-yet-valid, tampered and foreign tokens are rejected with the right code", async () => {
  const config = { tokenSecrets: [secret("k1")], tokenTtlSeconds: 3600 };
  const { token } = await issueDeviceToken(config, { installId: "install-1", platform: "android" }, NOW);

  await rejects(verifyDeviceToken(config, token, NOW + 3600 + 31), "token_expired");
  assert.ok(await verifyDeviceToken(config, token, NOW + 3600 + 29), "30 s of clock skew is tolerated");
  await rejects(verifyDeviceToken(config, token, NOW - 120), "unauthorized");

  const [header, payload, signature] = token.split(".");
  const forgedPayload = b64url.encode(JSON.stringify({ ...JSON.parse(b64url.decode(payload).toString()), sub: "someone-else" }));
  await rejects(verifyDeviceToken(config, `${header}.${forgedPayload}.${signature}`, NOW), "unauthorized");
  await rejects(verifyDeviceToken(config, `${header}.${payload}.${signature.slice(0, -2)}AA`, NOW), "unauthorized");
  await rejects(verifyDeviceToken(config, "not-a-jwt", NOW), "unauthorized");
  await rejects(verifyDeviceToken({ tokenSecrets: [] }, token, NOW), "unauthorized");
});

test("[REQ-SEC-003] algorithm-confusion attacks fail: alg=none, a different HMAC algorithm and a wrong audience or issuer", async () => {
  const signer = secret("k1");
  const config = { tokenSecrets: [signer], tokenTtlSeconds: 3600 };

  const none = `${b64url.encode(JSON.stringify({ alg: "none", kid: "k1", typ: "JWT" }))}.${b64url.encode(JSON.stringify({ sub: "x", iss: TOKEN_ISSUER, aud: TOKEN_AUDIENCE, iat: NOW, exp: NOW + 600, jti: "j" }))}.`;
  await rejects(verifyDeviceToken(config, none, NOW), "unauthorized");

  const base = () => new SignJWT({ scope: "read tools" }).setSubject("x").setIssuedAt(NOW).setExpirationTime(NOW + 600).setJti("j");
  const hs512 = await base().setProtectedHeader({ alg: "HS512", kid: "k1", typ: "JWT" }).setIssuer(TOKEN_ISSUER).setAudience(TOKEN_AUDIENCE).sign(signer.key);
  await rejects(verifyDeviceToken(config, hs512, NOW), "unauthorized");

  const wrongAudience = await base().setProtectedHeader({ alg: "HS256", kid: "k1", typ: "JWT" }).setIssuer(TOKEN_ISSUER).setAudience("someone-elses-api").sign(signer.key);
  await rejects(verifyDeviceToken(config, wrongAudience, NOW), "unauthorized");

  const wrongIssuer = await base().setProtectedHeader({ alg: "HS256", kid: "k1", typ: "JWT" }).setIssuer("evil").setAudience(TOKEN_AUDIENCE).sign(signer.key);
  await rejects(verifyDeviceToken(config, wrongIssuer, NOW), "unauthorized");

  const noJti = await new SignJWT({}).setProtectedHeader({ alg: "HS256", kid: "k1", typ: "JWT" }).setIssuer(TOKEN_ISSUER).setAudience(TOKEN_AUDIENCE).setSubject("x").setIssuedAt(NOW).setExpirationTime(NOW + 600).sign(signer.key);
  await rejects(verifyDeviceToken(config, noJti, NOW), "unauthorized");
});

test("[REQ-SEC-003] key rotation: the first secret signs, every configured secret verifies", async () => {
  const oldKey = secret("k1");
  const newKey = secret("k2");
  const before = await issueDeviceToken({ tokenSecrets: [oldKey], tokenTtlSeconds: 3600 }, { installId: "install-1", platform: "android" }, NOW);

  const rotated = { tokenSecrets: [newKey, oldKey], tokenTtlSeconds: 3600 };
  assert.ok(await verifyDeviceToken(rotated, before.token, NOW), "tokens signed before the rotation still verify");
  const after = await issueDeviceToken(rotated, { installId: "install-1", platform: "android" }, NOW);
  assert.match(after.token.split(".")[0], /^[A-Za-z0-9_-]+$/);
  assert.equal(JSON.parse(b64url.decode(after.token.split(".")[0]).toString()).kid, "k2");

  await rejects(verifyDeviceToken({ tokenSecrets: [newKey], tokenTtlSeconds: 3600 }, before.token, NOW), "unauthorized");
});

test("[REQ-SEC-004] proof of work: a solved challenge verifies, anything else does not", () => {
  const config = { tokenSecrets: [secret("k1")] };
  const issued = issueChallenge(config, 10, NOW);
  assert.equal(issued.difficulty, 10);
  assert.equal(issued.algorithm, "sha256-leading-zero-bits");
  const nonce = solveChallenge(issued.challenge);
  const solved = verifySolution(config, { challenge: issued.challenge, nonce }, NOW + 1);
  assert.equal(solved.d, 10);

  const [payloadB64, signature] = issued.challenge.split(".");
  const easier = b64url.encode(JSON.stringify({ ...JSON.parse(b64url.decode(payloadB64).toString()), d: 1 }));
  assert.throws(() => verifySolution(config, { challenge: `${easier}.${signature}`, nonce: "0" }, NOW), (e: unknown) => e instanceof ApiError && e.code === "challenge_invalid", "lowering the difficulty breaks the signature");
  assert.throws(() => verifySolution(config, { challenge: issued.challenge, nonce: "not-a-number" }, NOW), (e: unknown) => e instanceof ApiError && e.code === "challenge_invalid");
  assert.throws(() => verifySolution(config, { challenge: issued.challenge, nonce }, NOW + 301), /expired/);
  assert.throws(() => verifySolution(config, { challenge: "garbage", nonce }, NOW), (e: unknown) => e instanceof ApiError && e.code === "challenge_invalid");
  assert.throws(() => verifySolution({ tokenSecrets: [secret("other")] }, { challenge: issued.challenge, nonce }, NOW), /unknown key/);

  let wrong = "0";
  const hard = issueChallenge(config, 16, NOW);
  while (leadingZeroBits(powDigest(JSON.parse(b64url.decode(hard.challenge.split(".")[0]).toString()).s, wrong)) >= 16) wrong = String(Number(wrong) + 1);
  assert.throws(() => verifySolution(config, { challenge: hard.challenge, nonce: wrong }, NOW), /does not meet/);
});

test("[REQ-SEC-004] difficulty rises with the recent issue rate and is capped", () => {
  const controller = new DifficultyController(60_000, 20);
  const bits = { base: 16, max: 22 };
  assert.equal(controller.difficulty(0, bits), 16);
  for (let index = 0; index < 60; index++) controller.record(1_000);
  assert.equal(controller.difficulty(2_000, bits), 18, "60 issues in a minute add two bits");
  for (let index = 0; index < 100_000; index++) controller.record(3_000);
  assert.equal(controller.difficulty(4_000, bits), 22, "never above the configured maximum");
  assert.equal(controller.difficulty(200_000, bits), 16, "the window forgets old issues");
});

test("[REQ-SEC-004] a solved challenge cannot be replayed within its lifetime", () => {
  const guard = new ReplayGuard(1000);
  assert.equal(guard.claim("sig-a", NOW + 300, NOW), true);
  assert.equal(guard.claim("sig-a", NOW + 300, NOW + 1), false);
  assert.equal(guard.claim("sig-b", NOW + 300, NOW + 1), true);
  assert.equal(guard.claim("sig-a", NOW + 300, NOW + 400), true, "after expiry the entry is forgotten");
});

test("[REQ-SEC-005] API keys: generated keys verify, hash is not the key, anything else fails", () => {
  const { key, hash, id } = generateApiKey("neuroprep");
  assert.match(key, /^rk\.neuroprep\.[A-Za-z0-9_-]{43}$/);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.ok(!key.includes(hash));
  const records = [{ id, hash, scopes: ["read" as const, "tools" as const], rpm: 600 }];
  assert.equal(verifyApiKey(key, records)?.id, "neuroprep");

  const tampered = `${key.slice(0, -1)}${key.endsWith("A") ? "B" : "A"}`;
  assert.equal(verifyApiKey(tampered, records), undefined);
  assert.equal(verifyApiKey(key.replace("neuroprep", "unknownapp"), records), undefined);
  for (const junk of ["", "rk.", "rk.neuroprep.", "rk..x", "Bearer x", "rk.neuroprep.short", "x".repeat(5000)]) assert.equal(verifyApiKey(junk, records), undefined);
  assert.throws(() => generateApiKey("Bad Id!"), RangeError);
  assert.notEqual(generateApiKey("neuroprep").key, key, "keys are random");
});

test("[REQ-SEC-006] secrets compare in constant time regardless of length", () => {
  assert.equal(secretsMatch("correct horse battery staple", "correct horse battery staple"), true);
  assert.equal(secretsMatch("correct horse battery stapl", "correct horse battery staple"), false);
  assert.equal(secretsMatch("", "x"), false);
  assert.equal(hashSecret("a").length, 32);
});

test("[REQ-SEC-002] authenticate: no header is anonymous; an invalid credential is a 401, never a silent downgrade", async () => {
  const key = generateApiKey("partner");
  const config = loadConfig({
    NODE_ENV: "test",
    RAAHI_TOKEN_SECRETS: `k1:${randomBytes(32).toString("base64url")}`,
    RAAHI_API_KEYS: JSON.stringify([{ id: key.id, hash: key.hash, scopes: ["read"], rpm: 300 }]),
    RAAHI_ADMIN_SECRET: "a-sufficiently-long-admin-secret-value",
  });
  const make = (authorization?: string) => new Request("http://localhost/x", { headers: authorization ? { authorization } : {} });

  assert.deepEqual(await authenticate(make(), config, NOW), { tier: "anonymous", id: "anonymous" });

  const client = await authenticate(make(`Bearer ${key.key}`), config, NOW);
  assert.equal(client.tier, "client");
  assert.equal(client.tier === "client" && client.rpm, 300);

  const { token } = await issueDeviceToken(config, { installId: "install-9", platform: "android" }, NOW);
  const device = await authenticate(make(`Bearer ${token}`), config, NOW);
  assert.equal(device.tier, "device");
  assert.equal(device.id, "install-9");

  await rejects(authenticate(make("Basic dXNlcjpwYXNz"), config, NOW), "unauthorized");
  await rejects(authenticate(make("Bearer"), config, NOW), "unauthorized");
  await rejects(authenticate(make(`Bearer ${key.key}x`), config, NOW), "unauthorized");
  await rejects(authenticate(make("Bearer " + "a".repeat(3000)), config, NOW), "unauthorized");
  await rejects(authenticate(make("Bearer some-random-secret"), config, NOW), "unauthorized");
  await rejects(authenticate(make("Bearer a-sufficiently-long-admin-secret-value"), config, NOW), "unauthorized");
  await rejects(authenticate(make(`Bearer ${token}`), config, NOW + 7200), "token_expired");

  const admin = await authenticate(make("Bearer a-sufficiently-long-admin-secret-value"), config, NOW, { allowAdmin: true });
  assert.equal(admin.tier, "admin");
  await rejects(authenticate(make("Bearer a-sufficiently-long-admin-secret-valuX"), config, NOW, { allowAdmin: true }), "unauthorized");
});
