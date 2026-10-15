/**
 * Deployment smoke test: exercises a RUNNING RAAHI instance over real HTTP.
 *
 *   npm run smoke                       # http://localhost:3000
 *   npm run smoke -- https://raahi-phi.vercel.app
 *
 * It checks the things that break in production but not in unit tests: security headers, CSP nonce, problem+json
 * errors, conditional GET, CORS preflight, and (when the server has token secrets) the complete proof-of-work device
 * registration flow ending in an authenticated call. Exit code 1 on any failure.
 */
import { solveChallenge } from "@/lib/platform/auth/pow";

const base = (process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const results: Array<{ name: string; ok: boolean; detail: string }> = [];

async function check(name: string, run: () => Promise<string | void>) {
  const started = performance.now();
  try {
    const detail = (await run()) ?? "";
    results.push({ name, ok: true, detail: `${detail} (${Math.round(performance.now() - started)} ms)`.trim() });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const get = (path: string, init: RequestInit = {}) => fetch(`${base}${path}`, { redirect: "manual", ...init });

async function main() {
  await check("liveness", async () => {
    const response = await get("/api/v1/health");
    expect(response.status === 200, `status ${response.status}`);
    expect(response.headers.get("x-content-type-options") === "nosniff", "missing nosniff");
    expect(response.headers.get("content-security-policy") === "default-src 'none'; frame-ancestors 'none'", "API CSP missing");
    expect(response.headers.get("x-request-id"), "no request id");
    expect(!response.headers.has("x-powered-by"), "x-powered-by leaks the framework");
  });

  await check("readiness (database + data)", async () => {
    const body = await (await get("/api/v1/ready")).json();
    expect(body.status === "ready", JSON.stringify(body));
    return `${body.checks.items} listings, data ${body.checks.data}`;
  });

  let deviceAuth = false;
  await check("meta", async () => {
    const body = await (await get("/api/v1/meta")).json();
    expect(body.api.version === "1", "api version");
    deviceAuth = body.features.deviceAuth === true;
    return `build ${body.api.build}, deviceAuth=${deviceAuth}`;
  });

  await check("search returns a contract-shaped page", async () => {
    const body = await (await get("/api/v1/opportunities?limit=3&kind=scholarship")).json();
    expect(Array.isArray(body.data) && body.data.length === 3, "expected 3 items");
    expect(/^[a-f0-9]{12}$/.test(body.data[0].rev), "rev");
    return `${body.page.total} scholarships`;
  });

  await check("conditional GET (ETag -> 304)", async () => {
    const first = await get("/api/v1/opportunities/manifest");
    const etag = first.headers.get("etag");
    expect(etag, "no ETag");
    await first.arrayBuffer();
    const second = await get("/api/v1/opportunities/manifest", { headers: { "If-None-Match": etag } });
    expect(second.status === 304, `expected 304, got ${second.status}`);
  });

  await check("errors are RFC 9457 problem documents", async () => {
    const response = await get("/api/v1/opportunities?bogus=1");
    expect(response.status === 400, `status ${response.status}`);
    expect(response.headers.get("content-type")?.startsWith("application/problem+json"), "content type");
    const body = await response.json();
    expect(body.code === "unknown_parameter" && body.requestId, JSON.stringify(body));
  });

  await check("CORS preflight", async () => {
    const response = await get("/api/v1/tools/age-check", { method: "OPTIONS", headers: { Origin: "https://example.org", "Access-Control-Request-Method": "POST" } });
    expect(response.status === 204, `status ${response.status}`);
  });

  await check("tools reject anonymous callers", async () => {
    const response = await get("/api/v1/tools/age-check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dob: "2000-01-01", asOn: "2026-10-15" }) });
    expect(response.status === 401, `status ${response.status}`);
    expect(response.headers.get("www-authenticate")?.startsWith("Bearer"), "no WWW-Authenticate");
  });

  await check("admin endpoints are closed to everyone else", async () => {
    expect((await get("/api/v1/metrics")).status === 401, "metrics must need the admin secret");
    expect((await get("/api/v1/admin/submissions")).status === 401, "moderation must need the admin secret");
  });

  if (deviceAuth) {
    await check("device registration (proof of work) -> authenticated call", async () => {
      const challenge = await (await get("/api/v1/auth/challenge")).json();
      const nonce = solveChallenge(challenge.challenge);
      const registered = await get("/api/v1/auth/device", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challenge: challenge.challenge, nonce, installId: crypto.randomUUID(), platform: "web" }),
      });
      expect(registered.status === 200, `registration status ${registered.status}`);
      const { accessToken } = await registered.json();
      const response = await get("/api/v1/tools/age-check", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ dob: "1998-03-15", asOn: "2026-10-15", maxYears: 28 }),
      });
      expect(response.status === 200, `authenticated call status ${response.status}`);
      return `difficulty ${challenge.difficulty}`;
    });
  } else {
    results.push({ name: "device registration", ok: true, detail: "skipped: this deployment has no RAAHI_TOKEN_SECRETS" });
  }

  await check("pages carry a nonce-based CSP and the hardening headers", async () => {
    const response = await get("/");
    expect(response.status === 200, `status ${response.status}`);
    const csp = response.headers.get("content-security-policy") ?? "";
    expect(/script-src[^;]*'nonce-/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp), "script-src must use a nonce, not unsafe-inline");
    expect(/frame-ancestors 'none'/.test(csp), "frame-ancestors");
    expect(response.headers.get("x-frame-options") === "DENY", "x-frame-options");
    const html = await response.text();
    expect(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(html), "third-party font origin referenced");
  });

  await check("cookie endpoints do not leak other visitors' data", async () => {
    const response = await get("/api/cases");
    const body = await response.json();
    expect(response.status === 200 && Array.isArray(body.results) && body.results.length === 0, "a brand-new visitor must see no cases");
  });

  const width = Math.max(...results.map((result) => result.name.length));
  for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"}  ${result.name.padEnd(width)}  ${result.detail}`);
  const failed = results.filter((result) => !result.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed against ${base}`);
  process.exit(failed > 0 ? 1 : 0);
}

void main();
