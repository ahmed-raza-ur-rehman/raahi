import { MODULES, MODULE_BY_ID, detailRoute, routesFor, type ModuleDefinition, type ModuleId } from "./registry";

/**
 * Which modules this deployment runs.
 *
 * Two environment variables, both optional, both comma-separated:
 *
 *   RAAHI_MODULES=scholarships,documents,tests,health,blood
 *       Only these modules run (plus the core ones, which cannot be turned
 *       off). Use this for a focused deployment — a university that only wants
 *       scholarships, or a district health office.
 *
 *   RAAHI_DISABLED_MODULES=portal,classic
 *       Everything except these. Use this when you want nearly all of RAAHI
 *       but not a particular screen.
 *
 * If you set neither, every module runs. Unknown names are ignored with a
 * warning rather than a crash, because a typo in an environment variable is a
 * bad reason to take a citizen-facing service offline.
 */

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

function resolve(): { enabled: Set<ModuleId>; unknown: string[] } {
  const enabled = new Set<ModuleId>();
  const unknown: string[] = [];

  const allowList = parseList(process.env.RAAHI_MODULES);
  const denyList = parseList(process.env.RAAHI_DISABLED_MODULES);

  if (allowList.length > 0) {
    for (const name of allowList) {
      if (MODULE_BY_ID.has(name as ModuleId)) enabled.add(name as ModuleId);
      else unknown.push(name);
    }
  } else {
    for (const definition of MODULES) enabled.add(definition.id);
  }

  for (const name of denyList) {
    if (MODULE_BY_ID.has(name as ModuleId)) enabled.delete(name as ModuleId);
    else unknown.push(name);
  }

  // Core modules always run. The home screen and the emergency numbers are
  // not optional: someone in trouble must always land somewhere useful.
  for (const definition of MODULES) {
    if (definition.core) enabled.add(definition.id);
  }

  return { enabled, unknown };
}

/**
 * Cached per process. Module configuration is read from the environment, which
 * does not change while the server is running, and this is consulted on every
 * request.
 */
let cached: { enabled: Set<ModuleId>; unknown: string[] } | undefined;

function state() {
  if (!cached) {
    cached = resolve();
    if (cached.unknown.length > 0) {
      console.warn(
        `[raahi] unknown module name(s) in RAAHI_MODULES / RAAHI_DISABLED_MODULES, ignoring: ${cached.unknown.join(", ")}`,
      );
    }
  }
  return cached;
}

/** Forget the cached value. Only needed when tests change the environment. */
export function resetModuleConfig(): void {
  cached = undefined;
}

export function isModuleEnabled(id: ModuleId): boolean {
  return state().enabled.has(id);
}

/** Every module that is switched on, in registry order. */
/**
 * The part of a module the browser needs. Defined once so the API and the
 * server-rendered layout can never disagree about what a module looks like.
 */
export function summariseModule(module: ModuleDefinition) {
  const detail = detailRoute(module);
  return {
    id: module.id,
    icon: module.icon,
    href: module.href,
    group: module.group,
    core: Boolean(module.core),
    title: module.title,
    blurb: module.blurb,
    keywords: module.keywords,
    ...(module.entityTypes ? { entityTypes: module.entityTypes } : {}),
    ...(module.entityKinds ? { entityKinds: module.entityKinds } : {}),
    ...(detail ? { detail } : {}),
  };
}

export type ModuleSummary = ReturnType<typeof summariseModule>;

export function enabledModules(): ModuleDefinition[] {
  const enabled = state().enabled;
  return MODULES.filter((definition) => enabled.has(definition.id));
}

/** The bottom navigation: core modules marked `inNav`, in registry order. */
export function navModules(): ModuleDefinition[] {
  return enabledModules().filter((module) => module.inNav);
}

/** Modules for the More screen, grouped so they are easy to scan. */
export function groupedModules(): { group: string; modules: ModuleDefinition[] }[] {
  const order = ["start", "learn", "life", "emergency", "manage"];
  const enabled = enabledModules();
  return order
    .map((group) => ({ group, modules: enabled.filter((definition) => definition.group === group) }))
    .filter((entry) => entry.modules.length > 0);
}

/** Names that were in the environment but are not real modules. */
export function unknownModuleNames(): string[] {
  return state().unknown;
}

/**
 * Is this request path served by an enabled module?
 *
 * Used to guard pages and APIs. Paths that belong to no module (the home
 * screen, /privacy, /offline, Next internals) are always allowed, so adding a
 * module to the registry can never accidentally lock someone out of the shell
 * around it.
 */
export function isPathEnabled(pathname: string): boolean {
  for (const definition of MODULES) {
    const owns = routesFor(definition).some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );
    const ownsApi = (definition.api ?? []).some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
    if (owns || ownsApi) return isModuleEnabled(definition.id);
  }
  return true;
}

/** Knowledge domains a deployment has switched on, for filtering search. */
export function enabledDomains(): Set<string> {
  const domains = new Set<string>();
  for (const definition of enabledModules()) {
    for (const domain of definition.domains ?? []) domains.add(domain);
  }
  return domains;
}
