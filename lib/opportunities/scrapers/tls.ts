import https from "node:https";
import tls from "node:tls";
import { GOGETSSL_RSA_DV_SSL_CA_2, SECTIGO_PUBLIC_SERVER_CA_DV_R36 } from "../../../data/opportunities/pk-certs";

/**
 * Some Pakistani government sites (FPSC, PMYP, DigiSkills) serve their own certificate but not the intermediate that
 * signed it. Browsers fetch the missing piece themselves; Node does not, and refuses the connection.
 *
 * The fix here is deliberately narrow: for a short list of known hosts, the matching public intermediate is added to
 * the trusted set for that one request. Verification stays ON — the chain must still end at a root Node already
 * trusts, and a wrong or missing intermediate still fails. Nothing here ever sets `rejectUnauthorized: false`.
 */

const SHARED: Record<string, string[]> = {
  "fpsc.gov.pk": [GOGETSSL_RSA_DV_SSL_CA_2],
  "pmyp.gov.pk": [GOGETSSL_RSA_DV_SSL_CA_2],
  "digiskills.pk": [SECTIGO_PUBLIC_SERVER_CA_DV_R36],
};

/** Extra intermediates for a host (and its subdomains), or undefined when the host needs none. */
export function extraCaFor(hostname: string, table: Record<string, string[]> = SHARED): string[] | undefined {
  const host = hostname.toLowerCase();
  for (const [domain, certificates] of Object.entries(table)) {
    if (host === domain || host.endsWith(`.${domain}`)) return certificates;
  }
  return undefined;
}

/** True for the "server did not send its intermediate" family of failures. */
export function isChainError(error: unknown): boolean {
  const code = (error as { cause?: { code?: string }; code?: string } | undefined)?.cause?.code ?? (error as { code?: string } | undefined)?.code;
  return code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY";
}

export interface ExtraCaRequest {
  headers: Record<string, string>;
  signal?: AbortSignal;
  maxBytes?: number;
}

/**
 * GET `url` over HTTPS trusting the normal roots plus `extraCa`. Follows redirects only within the same host (the
 * extra certificates are for that host alone). Returns a standard `Response`, so callers need no special handling.
 */
export function fetchWithExtraCa(url: string, request: ExtraCaRequest, extraCa: string[], redirectsLeft = 5): Promise<Response> {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    if (target.protocol !== "https:") {
      reject(new Error("The certificate fallback is for https URLs only"));
      return;
    }
    const maxBytes = request.maxBytes ?? 15 * 1024 * 1024;
    const outgoing = https.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || 443,
        path: `${target.pathname}${target.search}`,
        method: "GET",
        servername: target.hostname,
        ca: [...tls.rootCertificates, ...extraCa],
        // identity: this path does not decompress, so ask for the body as it is
        headers: { ...request.headers, "Accept-Encoding": "identity" },
        signal: request.signal,
      },
      (incoming) => {
        const status = incoming.statusCode ?? 0;
        const location = incoming.headers.location;
        if (status >= 300 && status < 400 && location) {
          incoming.resume();
          const next = new URL(location, target);
          if (redirectsLeft <= 0 || next.protocol !== "https:" || next.hostname !== target.hostname) {
            reject(new Error(`Redirect to ${next.origin} not followed`));
            return;
          }
          fetchWithExtraCa(next.toString(), request, extraCa, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        incoming.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            outgoing.destroy(new Error("Response too large"));
            return;
          }
          chunks.push(chunk);
        });
        incoming.on("end", () => {
          const headers = new Headers();
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value !== undefined) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
          }
          resolve(new Response(status === 204 || status === 304 ? null : Buffer.concat(chunks), { status, headers }));
        });
        incoming.on("error", reject);
      },
    );
    outgoing.on("error", reject);
    outgoing.end();
  });
}
