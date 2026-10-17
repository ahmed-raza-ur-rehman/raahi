import { guardLegacy } from "@/lib/platform/legacy";
import { CORS_HEADERS, jsonResponse, optionsResponse } from "@/lib/opportunities/api";
import { buildDigest } from "@/lib/opportunities/digest";
import { siteOrigin } from "@/lib/opportunities/feeds";
import { prepareOpportunities } from "@/lib/opportunities/store";

export const dynamic = "force-dynamic";

/**
 * GET /api/opportunities/digest?lang=en|ur&format=text|html|json&max=1500
 *
 * A short "what to look at today" message — closing within 7 days, new in Pakistan, new abroad, yearly programmes to
 * act on — ready to paste into WhatsApp (`format=text`, the default) or post to Telegram (`format=html`).
 */
async function handleGET(request: Request) {
  const params = new URL(request.url).searchParams;
  const language = params.get("lang") === "ur" ? "ur" : "en";
  const max = Math.min(Math.max(Number(params.get("max")) || 3800, 600), 4000);
  await prepareOpportunities();
  const digest = buildDigest({ origin: siteOrigin(request), language, maxChars: max });

  const format = params.get("format");
  if (format === "json") return jsonResponse(digest, { cache: true });
  const body = format === "html" ? digest.html : digest.text;
  return new Response(body, {
    headers: {
      "Content-Type": `${format === "html" ? "text/html" : "text/plain"}; charset=utf-8`,
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      ...CORS_HEADERS,
    },
  });
}

export function OPTIONS() {
  return optionsResponse();
}

/** Public and cookie-free (the widget and sibling apps call it cross-origin), so no cross-site check; rate limited per client address. */
export const GET = guardLegacy(handleGET, { name: "digestLegacy", csrf: false, limits: [{ policy: "read", by: "ip" }] });
