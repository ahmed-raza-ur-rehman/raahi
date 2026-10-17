import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import https from "node:https";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { GOGETSSL_RSA_DV_SSL_CA_2, SECTIGO_PUBLIC_SERVER_CA_DV_R36 } from "@/data/opportunities/pk-certs";
import { createHttpClient } from "@/lib/opportunities/scrapers/http";
import { extraCaFor, isChainError } from "@/lib/opportunities/scrapers/tls";

/**
 * Servers that omit their intermediate certificate. The chain below (root → intermediate → leaf) is generated with
 * openssl at test time — no key material is committed — and a local HTTPS server presents the leaf only, exactly
 * like the .gov.pk sites do.
 */

const hasOpenssl = spawnSync("openssl", ["version"]).status === 0;

function openssl(cwd: string, args: string[], input?: string) {
  const result = spawnSync("openssl", args, { cwd, input, encoding: "utf8" });
  assert.equal(result.status, 0, `openssl ${args.slice(0, 2).join(" ")} failed: ${result.stderr}`);
}

function buildChain(dir: string) {
  openssl(dir, ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", "root.key", "-out", "root.pem", "-days", "3650", "-subj", "/CN=RAAHI Test Root"]);
  openssl(dir, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "inter.key", "-out", "inter.csr", "-subj", "/CN=RAAHI Test Intermediate"]);
  writeFileSync(join(dir, "inter.ext"), "basicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\n");
  openssl(dir, ["x509", "-req", "-in", "inter.csr", "-CA", "root.pem", "-CAkey", "root.key", "-CAcreateserial", "-out", "inter.pem", "-days", "3650", "-extfile", "inter.ext"]);
  openssl(dir, ["req", "-newkey", "rsa:2048", "-nodes", "-keyout", "leaf.key", "-out", "leaf.csr", "-subj", "/CN=localhost"]);
  writeFileSync(join(dir, "leaf.ext"), "subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=CA:FALSE\n");
  openssl(dir, ["x509", "-req", "-in", "leaf.csr", "-CA", "inter.pem", "-CAkey", "inter.key", "-CAcreateserial", "-out", "leaf.pem", "-days", "3650", "-extfile", "leaf.ext"]);
  const read = (name: string) => readFileSync(join(dir, name), "utf8");
  return { root: read("root.pem"), intermediate: read("inter.pem"), leaf: read("leaf.pem"), key: read("leaf.key") };
}

test("built-in table: known hosts get their intermediate, others get nothing", () => {
  assert.deepEqual(extraCaFor("www.fpsc.gov.pk"), [GOGETSSL_RSA_DV_SSL_CA_2]);
  assert.deepEqual(extraCaFor("FPSC.gov.pk"), [GOGETSSL_RSA_DV_SSL_CA_2]);
  assert.deepEqual(extraCaFor("pmyp.gov.pk"), [GOGETSSL_RSA_DV_SSL_CA_2]);
  assert.deepEqual(extraCaFor("www.digiskills.pk"), [SECTIGO_PUBLIC_SERVER_CA_DV_R36]);
  assert.equal(extraCaFor("example.com"), undefined);
  assert.equal(extraCaFor("notfpsc.gov.pk"), undefined, "a look-alike domain must not match");
  assert.match(GOGETSSL_RSA_DV_SSL_CA_2, /^-----BEGIN CERTIFICATE-----\n[\s\S]+\n-----END CERTIFICATE-----$/);
  assert.match(SECTIGO_PUBLIC_SERVER_CA_DV_R36, /^-----BEGIN CERTIFICATE-----\n[\s\S]+\n-----END CERTIFICATE-----$/);
});

test("chain errors are recognised, other failures are not", () => {
  assert.equal(isChainError(Object.assign(new Error("fetch failed"), { cause: { code: "UNABLE_TO_VERIFY_LEAF_SIGNATURE" } })), true);
  assert.equal(isChainError(Object.assign(new Error("x"), { code: "UNABLE_TO_GET_ISSUER_CERT_LOCALLY" })), true);
  assert.equal(isChainError(Object.assign(new Error("fetch failed"), { cause: { code: "ETIMEDOUT" } })), false);
  assert.equal(isChainError(Object.assign(new Error("fetch failed"), { cause: { code: "CERT_HAS_EXPIRED" } })), false, "an expired certificate is never papered over");
  assert.equal(isChainError(new Error("boom")), false);
});

test("a server that omits its intermediate works with the intermediate added — and still fails without it", { skip: !hasOpenssl && "openssl is not available" }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "raahi-tls-"));
  const chain = buildChain(dir);
  const server = https.createServer({ key: chain.key, cert: chain.leaf /* the leaf ONLY, as the real sites do */ }, (request, response) => {
    if (request.url === "/robots.txt") {
      response.writeHead(404).end();
    } else if (request.url === "/jobs") {
      response.setHeader("content-type", "application/json").end(JSON.stringify({ success: true, data: [{ id: 1 }] }));
    } else if (request.url === "/old") {
      response.writeHead(301, { location: "/jobs" }).end();
    } else if (request.url === "/elsewhere") {
      response.writeHead(302, { location: "https://example.invalid/x" }).end();
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `https://localhost:${port}`;
  const noSleep = { sleep: async () => undefined, hostDelayMs: 0, retries: 0, timeoutMs: 5000 };
  try {
    // 1. Without help the request fails: the issuer cannot be found.
    await assert.rejects(createHttpClient({ ...noSleep, extraCa: {} }).getJson(`${base}/jobs`, { respectRobots: false }), (error: unknown) => isChainError(error) || /certificate|fetch failed/i.test(String(error)));

    // 2. With the root and intermediate for this host the same request succeeds (verification is still on).
    const helped = createHttpClient({ ...noSleep, extraCa: { localhost: [chain.root, chain.intermediate] } });
    assert.deepEqual(await helped.getJson(`${base}/jobs`, { respectRobots: false }), { success: true, data: [{ id: 1 }] });

    // 3. robots.txt goes through the same path, and a redirect inside the host is followed.
    const withRobots = await helped.getText(`${base}/old`);
    assert.equal(withRobots.status, 200);
    assert.match(withRobots.text, /"success":true/);

    // 4. A redirect to another host is not followed with the extra certificates.
    await assert.rejects(helped.getText(`${base}/elsewhere`, { respectRobots: false }), /not followed/);

    // 5. Verification really is on: a missing intermediate (root alone) is still refused, and so is the wrong host.
    await assert.rejects(createHttpClient({ ...noSleep, extraCa: { localhost: [chain.root] } }).getJson(`${base}/jobs`, { respectRobots: false }));
    await assert.rejects(createHttpClient({ ...noSleep, extraCa: { "other.example": [chain.root, chain.intermediate] } }).getJson(`${base}/jobs`, { respectRobots: false }));
  } finally {
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
