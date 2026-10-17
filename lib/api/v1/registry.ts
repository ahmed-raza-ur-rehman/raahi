import { z } from "zod";
import { buildOpenApi } from "@/lib/platform/openapi";
import { defineOperation, type Operation } from "@/lib/platform/route";
import { OPERATIONS } from "./operations";
import * as S from "./schemas";

/** The generated OpenAPI 3.1 document for every v1 operation (including the one that serves it). */
export function openApiDocument(serverUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || "https://raahi-phi.vercel.app") {
  return buildOpenApi(ALL_OPERATIONS, {
    title: "RAAHI Opportunities API",
    version: "1.0.0",
    serverUrl: serverUrl.replace(/\/$/, ""),
    description: [
      "Public, read-mostly API for RAAHI: opportunities (scholarships, jobs, internships, competitions, courses), the yearly planner, guides, the resource directory and a few tools.",
      "",
      "**Authentication tiers.** Anonymous (read-only, tightest limits) - device token (short-lived; obtained by solving a proof-of-work challenge; used by the Android app) - partner API key - administrator secret. A credential that is present but invalid is rejected with 401, never silently ignored.",
      "",
      "**Errors** are RFC 9457 `application/problem+json` documents with a stable `code`. **Rate limits** are advertised in `RateLimit-*` headers; a rejected request carries `Retry-After`.",
      "",
      "**Caching.** Anonymous GETs are CDN-cacheable and carry an `ETag`; send `If-None-Match` to get `304`. Credentialed responses are `private`.",
    ].join("\n"),
    components: {
      Opportunity: S.opportunitySchema,
      Programme: S.programmeSchema,
      GuideSummary: S.guideSummarySchema,
      GuideDetail: S.guideDetailSchema,
      Resource: S.resourceSchema,
      DataMeta: S.dataMeta,
    },
    problemSchema: S.problemSchema,
  });
}

export const openApiOperation = defineOperation({
  id: "getOpenApi",
  method: "GET",
  path: "/api/v1/openapi.json",
  summary: "This API's OpenAPI 3.1 description",
  tags: ["Service"],
  auth: "none",
  rate: "health",
  cors: "public",
  cache: { kind: "public", maxAge: 300, sMaxAge: 3600, swr: 86_400 },
  responses: { 200: { description: "The OpenAPI document.", schema: z.looseObject({ openapi: z.string() }) } },
  handler: () => openApiDocument(),
});

/** Every operation, in the order they are documented. */
export const ALL_OPERATIONS: readonly Operation[] = [...OPERATIONS, openApiOperation];
