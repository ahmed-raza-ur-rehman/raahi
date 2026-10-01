import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { MODULES, MODULE_BY_ID, detailRoute, routesFor } from "@/lib/modules/registry";
import type { KnowledgeEntityType } from "@/lib/types";
import {
  enabledModules,
  summariseModule,
  groupedModules,
  isModuleEnabled,
  isPathEnabled,
  navModules,
  resetModuleConfig,
  unknownModuleNames,
} from "@/lib/modules/config";

/**
 * The module system is only useful if it can be trusted. These tests keep it
 * honest against the app itself: a module that points at a route that does not
 * exist, or a module nobody can reach, is worse than no module at all.
 */

const root = process.cwd();

/** Every entity type the knowledge base can return. */
const KNOWLEDGE_ENTITY_TYPES: KnowledgeEntityType[] = [
  "service",
  "opportunity",
  "document",
  "test",
  "camp",
  "disease",
  "medical_procedure",
  "blood_bank",
  "disaster_channel",
  "disaster_guide",
  "legal_topic",
  "contact",
];

/**
 * Every page route that exists, taken from the filesystem rather than from a
 * list someone has to remember to update. Route groups `(app)` are invisible
 * in the URL, so they are stripped; dynamic segments are kept.
 */
function pageRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry.startsWith("(")) walk(full, prefix); // route group: not in the URL
        else if (entry === "api") continue;
        else walk(full, prefix === "" ? entry : `${prefix}/${entry}`);
      } else if (entry === "page.tsx") {
        routes.add(prefix);
      }
    }
  };
  walk(join(root, "app"), "");
  return routes;
}

/** Every API route path, relative to /api. */
function apiRoutes(): Set<string> {
  const routes = new Set<string>();
  const walk = (dir: string, prefix: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full, prefix === "" ? entry : `${prefix}/${entry}`);
      } else if (entry === "route.ts") {
        routes.add(prefix);
      }
    }
  };
  walk(join(root, "app", "api"), "");
  return routes;
}

/** "/scholarships/[id]" -> "scholarships/[id]" */
const asRoute = (path: string) => path.replace(/^\//, "");


function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = { ...process.env };
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetModuleConfig();
  try {
    run();
  } finally {
    for (const key of Object.keys(values)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    resetModuleConfig();
  }
}

/* ─────────────────── The registry describes the real app ─────────────────── */

test("every module points at a page that exists", () => {
  const real = pageRoutes();
  const missing: string[] = [];
  for (const definition of MODULES) {
    for (const route of routesFor(definition)) {
      if (!real.has(asRoute(route))) missing.push(`${definition.id} \u2192 ${route}`);
    }
  }
  assert.deepEqual(missing, [], `modules pointing at pages that do not exist:\n  ${missing.join("\n  ")}`);
});

test("every module id is unique and every module has what the UI needs", () => {
  const ids = MODULES.map((module) => module.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate module id");

  for (const definition of MODULES) {
    assert.ok(definition.icon.length > 0, `${definition.id} needs an icon`);
    assert.ok(definition.title.en.length > 0, `${definition.id} needs an English title`);
    assert.ok((definition.title.ur ?? "").length > 0, `${definition.id} needs an Urdu title`);
    assert.ok(definition.blurb.en.length > 0, `${definition.id} needs an English blurb`);
    assert.ok(definition.href.startsWith("/"), `${definition.id} href must be a path`);
  }
});

test("every module is reachable in every language we support", () => {
  for (const definition of MODULES) {
    for (const language of ["en", "ur", "ps", "hkp"] as const) {
      const keywords = definition.keywords[language];
      assert.ok(keywords && keywords.length > 0, `${definition.id} needs ${language} keywords so the palette can find it`);
    }
  }
});

test("the bottom navigation stays small enough to tap", () => {
  const inNav = MODULES.filter((definition) => definition.inNav);
  assert.ok(inNav.length <= 5, `${inNav.length} items in the bottom nav is too many for a phone`);
  // Home is part of the shell, not a module, so four modules plus More fit.
  assert.ok(inNav.length >= 2, "the nav should offer somewhere to go");
});

test("core modules cannot be switched off", () => {
  const core = MODULES.filter((definition) => definition.core).map((definition) => definition.id);
  assert.ok(core.length > 0, "some modules should be permanent");
  for (const id of core) {
    withEnv({ RAAHI_MODULES: "scholarships" }, () => {
      assert.equal(isModuleEnabled(id), true, `${id} must survive a restrictive allow-list`);
    });
    withEnv({ RAAHI_DISABLED_MODULES: id }, () => {
      assert.equal(isModuleEnabled(id), true, `${id} must survive an explicit disable`);
    });
  }
});

/* ─────────────────── Switching modules on and off ─────────────────── */

test("everything runs when nothing is configured", () => {
  withEnv({ RAAHI_MODULES: undefined, RAAHI_DISABLED_MODULES: undefined }, () => {
    assert.equal(enabledModules().length, MODULES.length);
  });
});

test("an allow-list runs only what it names", () => {
  withEnv({ RAAHI_MODULES: "scholarships,blood", RAAHI_DISABLED_MODULES: undefined }, () => {
    assert.equal(isModuleEnabled("scholarships"), true);
    assert.equal(isModuleEnabled("blood"), true);
    assert.equal(isModuleEnabled("disaster"), false);
    assert.equal(isModuleEnabled("portal"), false);
    // And the paths follow.
    assert.equal(isPathEnabled("/scholarships"), true);
    assert.equal(isPathEnabled("/disaster"), false);
    assert.equal(isPathEnabled("/api/blood"), true);
    assert.equal(isPathEnabled("/api/disaster"), false);
  });
});

test("a deny-list removes just what it names", () => {
  withEnv({ RAAHI_MODULES: undefined, RAAHI_DISABLED_MODULES: "classic,portal" }, () => {
    assert.equal(isModuleEnabled("classic"), false);
    assert.equal(isModuleEnabled("scholarships"), true);
  });
});

test("configuration is forgiving about spaces, case and typos", () => {
  withEnv({ RAAHI_MODULES: " Scholarships , Blood ", RAAHI_DISABLED_MODULES: undefined }, () => {
    assert.equal(isModuleEnabled("scholarships"), true, "should trim and lowercase");
    assert.equal(isModuleEnabled("blood"), true);
  });

  withEnv({ RAAHI_MODULES: "scholarships,not-a-module", RAAHI_DISABLED_MODULES: undefined }, () => {
    assert.equal(isModuleEnabled("scholarships"), true, "a typo must not disable the good names");
    assert.deepEqual(unknownModuleNames(), ["not-a-module"]);
  });
});

test("the shell around the modules always stays reachable", () => {
  withEnv({ RAAHI_MODULES: "scholarships", RAAHI_DISABLED_MODULES: undefined }, () => {
    for (const path of ["/", "/privacy", "/offline", "/api/health"]) {
      assert.equal(isPathEnabled(path), true, `${path} must work even in a minimal deployment`);
    }
  });
});

test("navigation and grouping only ever contain enabled modules", () => {
  withEnv({ RAAHI_MODULES: "scholarships,health,track", RAAHI_DISABLED_MODULES: undefined }, () => {
    for (const definition of navModules()) assert.equal(isModuleEnabled(definition.id), true);
    for (const entry of groupedModules()) {
      for (const definition of entry.modules) assert.equal(isModuleEnabled(definition.id), true);
    }
    assert.equal(groupedModules().every((entry) => entry.modules.length > 0), true, "no empty groups");
  });
});

test("a disabled module's own routes are guarded, including its detail pages", () => {
  withEnv({ RAAHI_MODULES: undefined, RAAHI_DISABLED_MODULES: "scholarships" }, () => {
    assert.equal(isPathEnabled("/scholarships"), false);
    assert.equal(isPathEnabled("/scholarships/sch-peef"), false, "detail pages must go with the list");
    assert.equal(isPathEnabled("/api/scholarships"), false);
    assert.equal(isPathEnabled("/api/scholarships/sch-peef"), false);
    // A different module is untouched.
    assert.equal(isPathEnabled("/documents"), true);
  });
});

test("unknown module names are reported, not silently swallowed twice", () => {
  withEnv({ RAAHI_MODULES: "ghost,phantom", RAAHI_DISABLED_MODULES: undefined }, () => {
    const unknown = unknownModuleNames();
    assert.ok(unknown.includes("ghost"));
    assert.ok(unknown.includes("phantom"));
    // With only bad names, the core modules must still be running.
    assert.ok(enabledModules().length > 0);
  });
});

/* ─────────────────── The registry keeps up with the app ─────────────────── */

test("every page in the app belongs to a module, or is explicitly part of the shell", () => {
  /**
   * Pages that are the shell rather than a capability: the home screen, the
   * grid that lists the modules, the privacy notice and the offline page.
   * These are not switchable — they are where a citizen lands.
   */
  const SHELL_PAGES = new Set(["", "more", "privacy", "offline"]);

  const claimed = new Set<string>();
  for (const definition of MODULES) {
    for (const route of routesFor(definition)) claimed.add(asRoute(route));
  }

  const orphans = [...pageRoutes()].filter((page) => !claimed.has(page) && !SHELL_PAGES.has(page));
  assert.deepEqual(
    orphans,
    [],
    `these pages are not in the module registry, so they cannot be switched off or found by the palette:\n  ${orphans.join("\n  ")}`,
  );
});

test("every API route is claimed by a module or is part of the platform", () => {
  /** Platform endpoints that exist for every deployment. */
  const PLATFORM_API = new Set([
    "health",
    "ocr",
    "vision",
    "translate",
    "voice",
    "language",
    "organizations",
    "web",
    "search",
    "modules", // the module list itself is platform, not a module
  ]);

  const claimed: string[] = [];
  for (const definition of MODULES) {
    for (const prefix of definition.api ?? []) claimed.push(prefix.replace(/^\/api\//, ""));
  }

  const owns = (api: string) => claimed.some((prefix) => api === prefix || api.startsWith(`${prefix}/`));
  const orphans = [...apiRoutes()].filter(
    (api) => !owns(api) && !PLATFORM_API.has(api) && !PLATFORM_API.has(api.split("/")[0]),
  );

  assert.deepEqual(
    orphans,
    [],
    `these API routes have no owning module, so they stay open when the module behind them is switched off:\n  ${orphans.join("\n  ")}`,
  );
});

test("looking up a module by id works and rejects nonsense", () => {
  assert.equal(MODULE_BY_ID.get("scholarships")?.href, "/scholarships");
  assert.equal(MODULE_BY_ID.get("nonsense" as never), undefined);
});

/* ─────────────────── Knowledge results know where to go ─────────────────── */

test("every knowledge entity type has a definition that can open it", () => {
  const claimed = new Set(MODULES.flatMap((definition) => definition.entityTypes ?? []));
  const missing = KNOWLEDGE_ENTITY_TYPES.filter((type) => !claimed.has(type));
  assert.deepEqual(
    missing,
    [],
    `knowledge results with no definition to open them would be dead ends: ${missing.join(", ")}`,
  );
});

test("a shared entity type is never ambiguous", () => {
  const owners = new Map<string, string[]>();
  for (const definition of MODULES) {
    for (const type of definition.entityTypes ?? []) owners.set(type, [...(owners.get(type) ?? []), definition.id]);
  }
  for (const [type, ids] of owners) {
    if (ids.length < 2) continue;
    // More than one definition can open this type, so each record's own kind must
    // say which one — otherwise a search result lands on the wrong screen.
    for (const id of ids) {
      const kinds = MODULE_BY_ID.get(id as never)?.entityKinds?.[type] ?? [];
      assert.ok(kinds.length > 0, `${id} shares "${type}" with others and must declare which kinds it handles`);
    }
    const all = new Set(ids.flatMap((id) => MODULE_BY_ID.get(id as never)?.entityKinds?.[type] ?? []));
    const declared = ids.flatMap((id) => MODULE_BY_ID.get(id as never)?.entityKinds?.[type] ?? []);
    assert.equal(all.size, declared.length, `"${type}" kinds must not be claimed twice`);
  }
});

test("detail routes belong to a definition that has the page", () => {
  const real = pageRoutes();
  for (const definition of MODULES) {
    const detail = detailRoute(definition);
    if (!detail) continue;
    assert.ok(real.has(asRoute(detail)), `${definition.id} claims ${detail}, which does not exist`);
  }
});

test("the summary the browser sees carries what the palette needs", () => {
  for (const definition of MODULES) {
    const summary = summariseModule(definition);
    assert.equal(summary.id, definition.id);
    assert.equal(summary.href, definition.href);
    assert.equal(summary.detail ?? undefined, detailRoute(definition));
    assert.deepEqual(summary.entityTypes ?? [], definition.entityTypes ?? []);
    assert.deepEqual(summary.entityKinds ?? {}, definition.entityKinds ?? {});
  }
});
