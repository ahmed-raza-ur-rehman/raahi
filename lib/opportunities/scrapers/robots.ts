/**
 * Minimal robots.txt implementation following RFC 9309:
 *  - the most specific user-agent group wins (our token, else `*`),
 *  - within a group the longest matching rule wins and `Allow` beats `Disallow` on ties,
 *  - `*` and `$` wildcards are supported, an empty `Disallow:` allows everything.
 */

export interface RobotsGroup {
  agents: string[];
  rules: Array<{ allow: boolean; pattern: string }>;
  crawlDelaySeconds?: number;
}

export interface RobotsRules {
  groups: RobotsGroup[];
  sitemaps: string[];
}

export function parseRobots(text: string): RobotsRules {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  let current: RobotsGroup | undefined;
  let lastWasAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (field === "sitemap") {
      if (value) sitemaps.push(value);
    } else if (current && (field === "allow" || field === "disallow")) {
      if (value) current.rules.push({ allow: field === "allow", pattern: value });
    } else if (current && field === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds) && seconds >= 0) current.crawlDelaySeconds = seconds;
    }
  }
  return { groups, sitemaps };
}

function patternToRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

function groupFor(rules: RobotsRules, agentToken: string): RobotsGroup[] {
  const token = agentToken.toLowerCase();
  const specific = rules.groups.filter((group) => group.agents.some((agent) => agent !== "*" && token.includes(agent)));
  if (specific.length > 0) return specific;
  return rules.groups.filter((group) => group.agents.includes("*"));
}

export function isAllowed(rules: RobotsRules, agentToken: string, pathWithQuery: string): boolean {
  const groups = groupFor(rules, agentToken);
  let best: { allow: boolean; length: number } | undefined;
  for (const group of groups) {
    for (const rule of group.rules) {
      if (!patternToRegex(rule.pattern).test(pathWithQuery)) continue;
      const length = rule.pattern.replace(/\*/g, "").length;
      if (!best || length > best.length || (length === best.length && rule.allow && !best.allow)) {
        best = { allow: rule.allow, length };
      }
    }
  }
  return best ? best.allow : true;
}

export function crawlDelay(rules: RobotsRules, agentToken: string): number | undefined {
  return groupFor(rules, agentToken).find((group) => group.crawlDelaySeconds !== undefined)?.crawlDelaySeconds;
}
