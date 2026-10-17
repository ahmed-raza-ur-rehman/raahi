import { z } from "zod";
import { ERROR_CATALOG, type ErrorCode } from "./errors";
import { RATE_POLICIES } from "./limit/limiter";
import type { AuthMode, Operation, OperationMeta } from "./route";

/**
 * OpenAPI 3.1 generator.
 *
 * The document is derived from the same `defineOperation` specs that run in production: parameters and bodies come
 * from the zod request schemas, responses from the declared response schemas, security from `auth`/`scope`, and the
 * error responses from `errors`. Nothing is written twice, so the published contract cannot describe behaviour the
 * code does not have (a contract test also validates the output against the official OpenAPI 3.1 JSON Schema).
 */

type Json = Record<string, unknown>;

export interface OpenApiOptions {
  title: string;
  version: string;
  description: string;
  serverUrl: string;
  /** Named, reusable component schemas (rendered once and referenced with `$ref`). */
  components: Record<string, z.ZodType>;
  problemSchema: z.ZodType;
}

const SECURITY: Record<AuthMode, Array<Record<string, string[]>>> = {
  none: [],
  optional: [{}, { deviceToken: [] }, { apiKey: [] }],
  required: [{ deviceToken: [] }, { apiKey: [] }],
  admin: [{ adminSecret: [] }],
};

const HEADERS = {
  RequestId: { description: "Correlation id for this request; quote it when reporting a problem.", schema: { type: "string" } },
  RateLimitLimit: { description: "Requests allowed per window for this caller and policy.", schema: { type: "integer" } },
  RateLimitRemaining: { description: "Requests still available right now.", schema: { type: "integer" } },
  RateLimitReset: { description: "Seconds until the full budget is available again.", schema: { type: "integer" } },
  RetryAfter: { description: "Seconds to wait before retrying.", schema: { type: "integer" } },
  ETag: { description: "Weak validator; send it back in `If-None-Match` to get `304 Not Modified`.", schema: { type: "string" } },
  WwwAuthenticate: { description: "How to authenticate (`Bearer`).", schema: { type: "string" } },
} as const;

/** `.describe()` and `.meta()` text lives in zod's global registry; the generator is given our id-only registry, so copy it over. */
const copyDescription = ({ zodSchema, jsonSchema }: { zodSchema: unknown; jsonSchema: Json }) => {
  const meta = z.globalRegistry.get(zodSchema as z.ZodType);
  if (meta?.description && jsonSchema.description === undefined) jsonSchema.description = meta.description;
};

function jsonSchema(schema: z.ZodType, registry: z.core.$ZodRegistry<{ id: string }>, io: "input" | "output"): Json {
  const out = z.toJSONSchema(schema, { target: "draft-2020-12", io, unrepresentable: "any", metadata: registry, override: copyDescription }) as Json;
  delete out.$schema;
  return out;
}

/** Collect `$defs` into `components.schemas` and point every `$ref` at them. */
function hoist(value: unknown, defs: Json): unknown {
  if (Array.isArray(value)) return value.map((entry) => hoist(entry, defs));
  if (value && typeof value === "object") {
    const record = value as Json;
    const out: Json = {};
    for (const [key, inner] of Object.entries(record)) {
      if (key === "$defs" && inner && typeof inner === "object") {
        for (const [name, schema] of Object.entries(inner as Json)) defs[name] = hoist(schema, defs);
        continue;
      }
      out[key] = key === "$ref" && typeof inner === "string" ? inner.replace("#/$defs/", "#/components/schemas/") : hoist(inner, defs);
    }
    return out;
  }
  return value;
}

function parametersOf(location: "path" | "query", schema: z.ZodType | undefined, registry: z.core.$ZodRegistry<{ id: string }>, defs: Json): Json[] {
  if (!schema) return [];
  const object = hoist(jsonSchema(schema, registry, "input"), defs) as { properties?: Record<string, Json>; required?: string[] };
  const required = new Set(object.required ?? []);
  return Object.entries(object.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === "path" ? true : required.has(name),
    ...(typeof property.description === "string" ? { description: property.description } : {}),
    schema: property,
  }));
}

function errorResponses(meta: OperationMeta): Record<string, Json> {
  const codes = new Set<ErrorCode>(meta.errors);
  codes.add("rate_limited");
  codes.add("internal");
  if (meta.auth === "required" || meta.auth === "admin") codes.add("unauthorized");
  if (meta.auth === "optional" && meta.scope !== "read") codes.add("unauthorized");
  if (meta.auth === "optional") codes.add("unauthorized"); // a presented credential can be invalid
  const grouped = new Map<number, ErrorCode[]>();
  for (const code of codes) {
    const status = ERROR_CATALOG[code].status;
    grouped.set(status, [...(grouped.get(status) ?? []), code]);
  }
  const responses: Record<string, Json> = {};
  for (const [status, list] of [...grouped].sort(([a], [b]) => a - b)) {
    const headers: Json = { "X-Request-Id": { $ref: "#/components/headers/RequestId" } };
    if (status === 429) Object.assign(headers, { "Retry-After": { $ref: "#/components/headers/RetryAfter" }, "RateLimit-Limit": { $ref: "#/components/headers/RateLimitLimit" }, "RateLimit-Remaining": { $ref: "#/components/headers/RateLimitRemaining" }, "RateLimit-Reset": { $ref: "#/components/headers/RateLimitReset" } });
    if (status === 401) headers["WWW-Authenticate"] = { $ref: "#/components/headers/WwwAuthenticate" };
    responses[String(status)] = {
      description: `${list.map((code) => `\`${code}\``).join(", ")} - ${ERROR_CATALOG[list[0]].title}.`,
      headers,
      content: { "application/problem+json": { schema: { $ref: "#/components/schemas/Problem" } } },
    };
  }
  return responses;
}

export function buildOpenApi(operations: readonly Operation[], options: OpenApiOptions): Json {
  const registry = z.registry<{ id: string }>();
  for (const [id, schema] of Object.entries({ Problem: options.problemSchema, ...options.components })) registry.add(schema, { id });

  const defs: Json = {};
  const paths: Record<string, Record<string, Json>> = {};

  for (const operation of [...operations].sort((a, b) => a.meta.path.localeCompare(b.meta.path) || a.meta.method.localeCompare(b.meta.method))) {
    const { meta } = operation;
    const parameters = [...parametersOf("path", meta.params, registry, defs), ...parametersOf("query", meta.query, registry, defs)];

    const responses: Record<string, Json> = {};
    for (const [status, spec] of Object.entries(meta.responses)) {
      const contentType = spec.contentType ?? "application/json";
      const headers: Json = { "X-Request-Id": { $ref: "#/components/headers/RequestId" } };
      if (meta.cache.kind === "public" && status === "200") headers.ETag = { $ref: "#/components/headers/ETag" };
      responses[status] = {
        description: spec.description,
        headers,
        content: { [contentType.split(";")[0]]: { schema: spec.schema ? hoist(jsonSchema(spec.schema, registry, "output"), defs) : { type: "string" }, ...(spec.example !== undefined ? { example: spec.example } : {}) } },
      };
    }
    if (meta.cache.kind === "public") responses["304"] = { description: "Not modified: the `If-None-Match` validator is still current." };
    Object.assign(responses, errorResponses(meta));

    const policy = RATE_POLICIES[meta.rate];
    (paths[meta.path] ??= {})[meta.method.toLowerCase()] = {
      operationId: meta.id,
      summary: meta.summary,
      ...(meta.description ? { description: meta.description } : {}),
      tags: meta.tags,
      security: SECURITY[meta.auth],
      ...(meta.auth === "optional" || meta.auth === "required" ? { "x-required-scope": meta.scope } : {}),
      "x-ratelimit-policy": { name: meta.rate, anonymousRequestsPerMinute: policy.rpm, burst: policy.burst },
      ...(parameters.length > 0 ? { parameters } : {}),
      ...(meta.body ? { requestBody: { required: true, content: { "application/json": { schema: hoist(jsonSchema(meta.body, registry, "input"), defs) } } } } : {}),
      responses,
    };
  }

  // Components registered explicitly are always published, even if no operation referenced them directly.
  const named = z.toJSONSchema(registry, { target: "draft-2020-12", io: "output", unrepresentable: "any", override: copyDescription, uri: (id) => `#/components/schemas/${id}` }) as { schemas: Record<string, Json> };
  const schemas: Json = {};
  for (const [name, schema] of Object.entries(named.schemas)) {
    const copy = { ...schema };
    delete copy.$schema;
    schemas[name] = hoist(copy, defs);
  }
  for (const [name, schema] of Object.entries(defs)) schemas[name] ??= schema;

  return {
    openapi: "3.1.0",
    info: {
      title: options.title,
      version: options.version,
      description: options.description,
      license: { name: "See LICENSE", url: "https://github.com/ahmed-raza-ur-rehman/raahi/blob/master/LICENSE" },
      "x-api-version": "1",
    },
    servers: [{ url: options.serverUrl }],
    tags: [...new Set(operations.flatMap((operation) => operation.meta.tags))].sort().map((name) => ({ name })),
    paths,
    components: {
      schemas,
      headers: HEADERS,
      securitySchemes: {
        deviceToken: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "Short-lived access token from `POST /api/v1/auth/device` (proof-of-work registration). Identifies an app install, not a person." },
        apiKey: { type: "http", scheme: "bearer", bearerFormat: "rk.<id>.<secret>", description: "Partner API key issued by the operator. Keep it on a server; never ship it in a browser or app." },
        adminSecret: { type: "http", scheme: "bearer", description: "Operator secret for `/admin/*` and `/metrics`." },
      },
    },
  };
}
