import type { PlatformConfig } from "../config";
import { ApiError } from "../errors";
import { metrics } from "../metrics";
import { looksLikeApiKey, secretsMatch, verifyApiKey } from "./api-keys";
import type { Principal } from "./principal";
import { verifyDeviceToken } from "./tokens";

const MAX_CREDENTIAL_LENGTH = 2048;

const challenge = (message: string) =>
  new ApiError("unauthorized", message, { headers: { "WWW-Authenticate": `Bearer realm="raahi"` } });

/**
 * Resolve the caller from the `Authorization` header.
 *
 *  - No header: anonymous.
 *  - A credential that is present but invalid is rejected with 401, never silently downgraded to anonymous: a
 *    downgrade would hide an expired token from the app (it would just get tighter limits and never refresh).
 *  - The admin secret is only considered on routes that ask for it (`allowAdmin`), so presenting it elsewhere is
 *    simply an invalid credential.
 */
export async function authenticate(request: Request, config: PlatformConfig, nowSeconds: number, options: { allowAdmin?: boolean } = {}): Promise<Principal> {
  const header = request.headers.get("authorization");
  if (header === null) return { tier: "anonymous", id: "anonymous" };

  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match || match[1].length > MAX_CREDENTIAL_LENGTH) {
    metrics.authFailures.inc({ reason: "malformed" });
    throw challenge("Use `Authorization: Bearer <credential>`.");
  }
  const credential = match[1];

  if (options.allowAdmin && config.adminSecret && !looksLikeApiKey(credential) && secretsMatch(credential, config.adminSecret)) {
    return { tier: "admin", id: "admin" };
  }

  if (looksLikeApiKey(credential)) {
    const record = verifyApiKey(credential, config.apiKeys);
    if (!record) {
      metrics.authFailures.inc({ reason: "api_key" });
      throw challenge("The API key is not valid.");
    }
    return { tier: "client", id: record.id, scopes: record.scopes, rpm: record.rpm };
  }

  if (credential.split(".").length === 3) {
    try {
      const claims = await verifyDeviceToken(config, credential, nowSeconds);
      return { tier: "device", id: claims.sub, scopes: claims.scopes };
    } catch (error) {
      metrics.authFailures.inc({ reason: error instanceof ApiError && error.code === "token_expired" ? "token_expired" : "token" });
      throw error;
    }
  }

  metrics.authFailures.inc({ reason: "unknown" });
  throw challenge("The credential is not valid.");
}
