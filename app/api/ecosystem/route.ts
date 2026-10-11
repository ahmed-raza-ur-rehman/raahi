import { jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { ECOSYSTEM, appUrl } from "@/lib/opportunities/ecosystem";

/** The RAAHI family of apps, so each can link to the others consistently. */
export function GET() {
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
