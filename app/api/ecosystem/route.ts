import { guardLegacy } from "@/lib/platform/legacy";
import { jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { ECOSYSTEM, appUrl } from "@/lib/opportunities/ecosystem";

/** The RAAHI family of apps, so each can link to the others consistently. */
function handleGET() {
  return jsonResponse(
    {
      apps: ECOSYSTEM.map((app) => ({ ...app, launchUrl: appUrl(app, "", "api"), routes: app.routes?.map((route) => ({ ...route, url: appUrl(app, route.path, "api") })) })),
      feeds: { opportunities: "/api/opportunities", resources: "/api/resources", status: "/api/opportunities/status" },
    },
    { cache: true },
  );
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy(handleGET, { name: "ecosystemLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
