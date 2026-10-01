import { NextResponse } from "next/server";

import { enabledModules, groupedModules, navModules, summariseModule, unknownModuleNames } from "@/lib/modules/config";
import { APP_VERSION } from "@/lib/version";

/**
 * What this deployment can do.
 *
 * The command palette and the More screen ask this rather than hard-coding a
 * list, so a deployment that switches modules off presents exactly the
 * capabilities it actually has — and a citizen is never shown a screen that
 * then refuses to work.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const unknown = unknownModuleNames();

  return NextResponse.json(
    {
      version: APP_VERSION,
      modules: enabledModules().map(summariseModule),
      nav: [{ href: "/", icon: "🏠", title: { en: "Home", ur: "گھر", ps: "کور", hkp: "گھر" } }, ...navModules().map(summariseModule)],
      groups: groupedModules().map((entry) => ({
        group: entry.group,
        modules: entry.modules.map(summariseModule),
      })),
      // Surfaced so a typo in an environment variable is visible rather than
      // silently doing nothing.
      ...(unknown.length > 0 ? { unknownModuleNames: unknown } : {}),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
