import { NextResponse } from "next/server";

import type { ModuleId } from "./registry";

import { isModuleEnabled, isPathEnabled } from "./config";

/**
 * Blocking a module's API when the module is switched off.
 *
 * A disabled module must not be reachable by calling its API directly: the
 * screen being hidden is not the same as the capability being off, and a
 * deployment that switched off blood donation should not still be accepting
 * blood requests.
 *
 * The response is a 404 rather than a 403 on purpose. A 403 confirms the
 * endpoint exists, which is exactly what someone probing a deployment wants to
 * know.
 */

export interface DisabledResponseOptions {
  /** Extra text for the operator's logs. Never shown to the citizen. */
  path?: string;
}

export function moduleDisabledResponse(options: DisabledResponseOptions = {}): NextResponse {
  if (options.path) {
    console.warn(`[raahi] blocked a request to a disabled module: ${options.path}`);
  }

  return NextResponse.json(
    {
      error: "That part of Raahi is not switched on here.",
      errorUr: "راہی کا یہ حصہ یہاں بند ہے۔",
      module: "disabled",
    },
    { status: 404, headers: { "cache-control": "no-store" } },
  );
}

/**
 * Guard for a route handler. Returns a ready-made 404 response when the path
 * belongs to a module that is switched off, or `undefined` when it is fine to
 * continue.
 *
 *   const blocked = guardModule(request);
 *   if (blocked) return blocked;
 */
export function guardModule(request: Request): NextResponse | undefined {
  const pathname = new URL(request.url).pathname;
  if (isPathEnabled(pathname)) return undefined;
  return moduleDisabledResponse({ path: pathname });
}

/**
 * Guard for a handler that knows which module it belongs to, rather than
 * deriving it from the path. Useful when one route serves several modules.
 */
export function guardModuleId(id: ModuleId, path?: string): NextResponse | undefined {
  if (isModuleEnabled(id)) return undefined;
  return moduleDisabledResponse({ path: path ?? id });
}
