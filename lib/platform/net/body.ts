import { ApiError } from "../errors";

/**
 * Read a JSON request body defensively.
 *
 *  - `Content-Type` must be JSON (415 otherwise) so other content types cannot smuggle data past validation.
 *  - The size cap is enforced while streaming, not after `request.json()` has already buffered everything, so an
 *    oversize upload costs at most `maxBytes` of memory (413).
 *  - Invalid UTF-8 and JSON syntax errors are 400s with generic messages (no parser internals).
 *  - Objects with `__proto__` / `constructor` keys are rejected outright (prototype-pollution attempts have no
 *    legitimate use in this API).
 */

const JSON_TYPE = /^application\/(?:[a-z0-9.+-]*\+)?json(?:\s*;.*)?$/i;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export async function readJsonBody(request: Request, maxBytes: number): Promise<unknown> {
  if (!JSON_TYPE.test(request.headers.get("content-type") ?? "")) throw new ApiError("unsupported_media_type");

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new ApiError("payload_too_large", `The body may be at most ${maxBytes} bytes.`);

  const bytes = await readCapped(request, maxBytes);
  if (bytes.length === 0) throw new ApiError("invalid_json", "The request body is empty.");

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ApiError("invalid_json", "The request body is not valid UTF-8.");
  }

  try {
    return JSON.parse(text, (key, value) => {
      if (FORBIDDEN_KEYS.has(key)) throw new ApiError("invalid_json", "The request body contains a forbidden key.");
      return value;
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("invalid_json");
  }
}

async function readCapped(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new ApiError("payload_too_large", `The body may be at most ${maxBytes} bytes.`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
