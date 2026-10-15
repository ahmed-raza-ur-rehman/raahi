import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { Validator } from "@seriousme/openapi-schema-validator";
import { ALL_OPERATIONS, openApiDocument } from "@/lib/api/v1/registry";
import { ERROR_CATALOG } from "@/lib/platform/errors";

const spec = openApiDocument("https://raahi-phi.vercel.app") as {
  openapi: string;
  paths: Record<string, Record<string, Record<string, unknown>>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown>; headers: Record<string, unknown> };
};

function walk(value: unknown, visit: (node: Record<string, unknown>) => void) {
  if (Array.isArray(value)) value.forEach((entry) => walk(entry, visit));
  else if (value && typeof value === "object") {
    visit(value as Record<string, unknown>);
    Object.values(value).forEach((entry) => walk(entry, visit));
  }
}

test("[REQ-API-007] the generated document is valid OpenAPI 3.1 according to the official JSON Schema", async () => {
  assert.equal(spec.openapi, "3.1.0");
  const validator = new Validator();
  const result = await validator.validate(JSON.parse(JSON.stringify(spec)));
  assert.equal(result.valid, true, `OpenAPI validation errors: ${JSON.stringify(result.valid ? [] : result.errors, null, 2).slice(0, 2000)}`);
});

test("[REQ-API-007] every $ref resolves and every declared component is used or intentionally published", () => {
  const refs = new Set<string>();
  walk(spec, (node) => {
    if (typeof node.$ref === "string") refs.add(node.$ref);
  });
  assert.ok(refs.size > 10);
  for (const ref of refs) {
    const [, section, name] = /^#\/components\/(schemas|headers)\/(.+)$/.exec(ref) ?? [];
    assert.ok(section, `unsupported $ref ${ref}`);
    assert.ok(name in (spec.components as Record<string, Record<string, unknown>>)[section], `dangling $ref ${ref}`);
  }
  for (const name of ["Problem", "Opportunity", "Programme", "GuideSummary", "GuideDetail", "Resource"]) assert.ok(name in spec.components.schemas, `${name} should be a published component`);
});

test("[REQ-API-001] operation ids are unique and every operation is documented under its path and method", () => {
  const ids = ALL_OPERATIONS.map((operation) => operation.meta.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate operationId");
  for (const { meta } of ALL_OPERATIONS) {
    const item = spec.paths[meta.path]?.[meta.method.toLowerCase()];
    assert.ok(item, `${meta.method} ${meta.path} is missing from the document`);
    assert.equal(item.operationId, meta.id);
    assert.ok(meta.path.startsWith("/api/v1/"), `${meta.path} is outside /api/v1`);
    assert.ok(meta.summary.length >= 8 && meta.tags.length >= 1, `${meta.id} needs a summary and a tag`);
  }
  const documented = Object.values(spec.paths).reduce((sum, methods) => sum + Object.keys(methods).length, 0);
  assert.equal(documented, ALL_OPERATIONS.length);
});

test("[REQ-API-001] path templates and path-parameter schemas agree in both directions", () => {
  for (const { meta } of ALL_OPERATIONS) {
    const inTemplate = [...meta.path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const parameters = (spec.paths[meta.path][meta.method.toLowerCase()].parameters ?? []) as Array<{ name: string; in: string; required: boolean }>;
    const declared = parameters.filter((parameter) => parameter.in === "path").map((parameter) => parameter.name).sort();
    assert.deepEqual(declared, inTemplate, `${meta.id}: path params in the template and in the schema differ`);
    assert.ok(parameters.filter((parameter) => parameter.in === "path").every((parameter) => parameter.required));
  }
});

test("[REQ-API-001] every v1 route file exists, exports the right method and OPTIONS, and no unregistered route file exists", () => {
  const registered = new Set<string>();
  for (const { meta } of ALL_OPERATIONS) {
    const relative = meta.path.replace("/api/v1/", "").replaceAll("{", "[").replaceAll("}", "]");
    const file = join(process.cwd(), "app", "api", "v1", relative, "route.ts");
    registered.add(file);
    assert.ok(existsSync(file), `${meta.id}: missing ${file}`);
    const source = readFileSync(file, "utf8");
    assert.match(source, new RegExp(`export const ${meta.method} = \\w+\\.handle;`), `${file} must export ${meta.method}`);
    assert.match(source, /export const OPTIONS = \w+\.preflight;/, `${file} must export OPTIONS`);
    assert.ok(!/export (async )?function/.test(source), `${file} must only re-export its operation`);
  }
  const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
  const found: string[] = [];
  const scan = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) scan(full);
      else if (entry === "route.ts") found.push(full);
    }
  };
  scan(join(process.cwd(), "app", "api", "v1"));
  for (const file of found) assert.ok(registered.has(file), `${file} is not backed by a registered operation`);
});

test("[REQ-SEC-002] security requirements match the auth mode of each operation", () => {
  for (const { meta } of ALL_OPERATIONS) {
    const operation = spec.paths[meta.path][meta.method.toLowerCase()] as { security: Array<Record<string, string[]>> };
    const schemes = operation.security.flatMap((entry) => Object.keys(entry));
    if (meta.auth === "none") assert.deepEqual(operation.security, [], meta.id);
    if (meta.auth === "admin") assert.deepEqual(schemes, ["adminSecret"], meta.id);
    if (meta.auth === "required") assert.deepEqual([...schemes].sort(), ["apiKey", "deviceToken"], meta.id);
    if (meta.auth === "optional") assert.ok(operation.security.some((entry) => Object.keys(entry).length === 0), `${meta.id}: anonymous access must be listed`);
  }
  assert.deepEqual(Object.keys(spec.components.securitySchemes).sort(), ["adminSecret", "apiKey", "deviceToken"]);
});

test("[REQ-API-002] every operation documents the problem+json errors it can return, including 429 with Retry-After", () => {
  for (const { meta } of ALL_OPERATIONS) {
    const responses = spec.paths[meta.path][meta.method.toLowerCase()].responses as Record<string, { content?: Record<string, { schema: { $ref?: string } }>; headers?: Record<string, unknown> }>;
    assert.ok(responses["429"] && responses["500"], `${meta.id}: 429 and 500 must be documented`);
    assert.ok("Retry-After" in (responses["429"].headers ?? {}), `${meta.id}: 429 must document Retry-After`);
    assert.equal(responses["429"].content?.["application/problem+json"].schema.$ref, "#/components/schemas/Problem");
    for (const code of meta.errors) assert.ok(responses[String(ERROR_CATALOG[code].status)], `${meta.id}: ${code} -> ${ERROR_CATALOG[code].status} is not documented`);
    if (meta.auth !== "none") assert.ok(responses["401"], `${meta.id}: 401 must be documented`);
  }
});

test("[REQ-API-005] cacheable operations document 304 and the ETag header", () => {
  for (const { meta } of ALL_OPERATIONS.filter((operation) => operation.meta.cache.kind === "public")) {
    const responses = spec.paths[meta.path][meta.method.toLowerCase()].responses as Record<string, { headers?: Record<string, unknown> }>;
    assert.ok(responses["304"], `${meta.id}: 304 missing`);
    assert.ok("ETag" in (responses["200"].headers ?? {}), `${meta.id}: ETag header missing`);
  }
});

test("[REQ-API-007] response schemas are strict so an accidental extra field is a contract violation", () => {
  const opportunity = spec.components.schemas.Opportunity as { additionalProperties?: unknown; required?: string[] };
  assert.equal(opportunity.additionalProperties, false);
  assert.ok(opportunity.required?.includes("rev") && opportunity.required.includes("id"));
});

test("[REQ-API-007] the committed openapi/raahi.v1.json is current (run `npm run openapi:write` after changing an operation)", () => {
  const committed = readFileSync(join(process.cwd(), "openapi", "raahi.v1.json"), "utf8");
  assert.equal(committed, `${JSON.stringify(spec, null, 2)}\n`);
});
