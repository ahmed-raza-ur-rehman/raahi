/**
 * Generate the committed OpenAPI description (openapi/raahi.v1.json) from the operation specs.
 *
 *   npm run openapi:write   regenerate the file
 *   npm run openapi:check   fail (exit 1) if the committed file is out of date - run in CI
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { openApiDocument } from "@/lib/api/v1/registry";

const target = join(process.cwd(), "openapi", "raahi.v1.json");
const generated = `${JSON.stringify(openApiDocument("https://raahi-phi.vercel.app"), null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (current !== generated) {
    console.error("openapi/raahi.v1.json is out of date. Run `npm run openapi:write` and commit the result.");
    process.exit(1);
  }
  console.log("openapi/raahi.v1.json is up to date.");
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, generated);
  console.log(`Wrote ${target} (${generated.length} bytes).`);
}
