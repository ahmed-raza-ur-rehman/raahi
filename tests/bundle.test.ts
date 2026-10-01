import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Guarding what reaches a citizen's phone.
 *
 * RAAHI is used on cheap Android phones over slow mobile data. Two mistakes
 * cost a visitor real money and real waiting, and both are invisible in code
 * review because the import that causes them looks completely innocent:
 *
 *  1. A client component importing a constant from a module that also imports
 *     the model SDK. That shipped the entire OpenAI SDK to the browser - 67 KB
 *     gzipped on the home page - for the sake of four language tags.
 *  2. A data module building a lookup `Map` at module scope. That pins the
 *     whole corpus into any bundle that touches the module, because the
 *     bundler cannot prove the side effect is unneeded.
 *
 * Both are now checked. Neither can come back quietly.
 */

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = walk(join(root, "app")).concat(walk(join(root, "components")), walk(join(root, "lib")));
const read = (file: string) => readFileSync(file, "utf8");

/** Modules that pull in a server-only dependency (the model SDK, the database). */
const SERVER_ONLY = [
  "@/lib/ai/client",
  "@/lib/ai/voice",
  "@/lib/ai/vision",
  "@/lib/ai/ocr",
  "@/lib/ai/agents",
  "@/lib/ai/orchestrator",
  "@/lib/ai/translate",
  "@/lib/db/client",
  "@/lib/rag/embeddings",
];

function clientComponents(): string[] {
  return sourceFiles.filter((file) => read(file).startsWith('"use client"'));
}

test("no client component imports a module that carries the model SDK", () => {
  const offenders: string[] = [];

  for (const file of clientComponents()) {
    const source = read(file);
    for (const serverModule of SERVER_ONLY) {
      // A type-only import disappears at compile time and is harmless.
      const importLines = source.split("\n").filter((line) => /^import\s/.test(line.trim()));
      for (const line of importLines) {
        if (line.includes("import type")) continue;
        if (line.includes(`from "${serverModule}"`) || line.includes(`from "${serverModule}.ts"`)) {
          offenders.push(`${relative(root, file)} imports ${serverModule}`);
        }
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `These would ship a server-only dependency to the browser. If the client needs a constant from one of them, move the constant into a leaf module (see lib/ai/speech-tags.ts):\n  ${offenders.join("\n  ")}`,
  );
});

test("the browser-safe leaf modules stay dependency-free", () => {
  // These exist precisely so client components can import from them. If one
  // ever grows a server import, the previous test will not catch it.
  for (const leaf of ["lib/ai/speech-tags.ts", "lib/ai/photo-checklist.ts"]) {
    const source = read(join(root, leaf));
    assert.ok(source.length > 0, `${leaf} should exist`);
    for (const forbidden of ["openai", "@/lib/ai/client", "@/lib/db/", "better-sqlite3"]) {
      assert.ok(!source.includes(forbidden), `${leaf} must not import ${forbidden}`);
    }
  }
});

test("no data module builds a lookup Map at module scope", () => {
  // A top-level `new Map(...)` over a corpus defeats tree-shaking: the bundler
  // must keep the array because building the map reads it.
  const offenders: string[] = [];

  for (const file of sourceFiles.filter((f) => f.includes(`${"data"}/`))) {
    const source = read(file);
    const matches = source.match(/export const \w+ = new Map\([^)]*\)/g) ?? [];
    for (const match of matches) {
      offenders.push(`${relative(root, file)}: ${match.slice(0, 60)}…`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `Module-scope Maps pin the whole corpus into any bundle that imports the file. Make them lazy, or drop them if nothing uses them:\n  ${offenders.join("\n  ")}`,
  );
});

test("the knowledge corpus is not imported by any client component", () => {
  // Pages should fetch their data; shipping the corpus to a phone is the
  // single most expensive mistake available to us.
  const offenders = clientComponents()
    .filter((file) => /from "@\/data\/(contacts|disaster|blood|scholarships|documents|health|legal|opportunities|tests|catalog)"/.test(read(file)))
    .map((file) => relative(root, file));

  assert.deepEqual(offenders, [], `These ship the knowledge corpus to the browser. Use the API routes instead:\n  ${offenders.join("\n  ")}`);
});
