import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";

export type Selection = cheerio.Cheerio<AnyNode>;

/**
 * Visible text of an element as separate tokens, one per text node, in document order.
 *
 * `.text()` glues neighbouring inline elements together ("Contract" + "BPS-20" + "1" becomes
 * "ContractBPS-201"), which makes cards impossible to parse reliably. Tokens keep the boundaries.
 */
export function textTokens(selection: Selection): string[] {
  const tokens: string[] = [];
  const visit = (node: AnyNode) => {
    if (node.type === "text") {
      const value = (node as unknown as { data: string }).data.replace(/\s+/g, " ").trim();
      if (value) tokens.push(value);
    } else if (node.type === "tag") {
      const element = node as unknown as { name: string; children: AnyNode[] };
      if (element.name === "script" || element.name === "style" || element.name === "noscript") return;
      for (const child of element.children) visit(child);
    }
  };
  selection.each((_, node) => visit(node));
  return tokens;
}

export interface Card {
  href: string;
  element: Selection;
  /** The first anchor pointing at `href` that has visible text (usually the title). */
  titleAnchor: Selection;
}

/**
 * Find "cards" without depending on CSS class names: every distinct link matching
 * `hrefPattern` identifies one listing, and its card is the largest ancestor that still
 * contains only that one listing link. Layout/styling changes rarely break this.
 */
export function findCards(
  $: cheerio.CheerioAPI,
  hrefPattern: RegExp,
  resolve: (href: string) => string | undefined,
  maxDepth = 6,
): Card[] {
  const byHref = new Map<string, Selection[]>();
  $("a[href]").each((_, node) => {
    const raw = $(node).attr("href");
    if (!raw) return;
    const resolved = resolve(raw);
    if (!resolved || !hrefPattern.test(resolved)) return;
    const list = byHref.get(resolved) ?? [];
    list.push($(node));
    byHref.set(resolved, list);
  });

  const distinctHrefsIn = (element: Selection) => {
    const found = new Set<string>();
    element.find("a[href]").each((_, node) => {
      const resolved = resolve($(node).attr("href") ?? "");
      if (resolved && hrefPattern.test(resolved)) found.add(resolved);
    });
    return found.size;
  };

  const cards: Card[] = [];
  for (const [href, anchors] of byHref) {
    const titleAnchor = anchors.find((anchor) => anchor.text().trim().length > 2) ?? anchors[0];
    let element: Selection = anchors[0];
    for (let depth = 0; depth < maxDepth; depth += 1) {
      const parent = element.parent();
      if (parent.length === 0) break;
      const tag = (parent.get(0) as unknown as { name?: string }).name;
      if (tag === "body" || tag === "html" || tag === "main") break;
      if (distinctHrefsIn(parent) > 1) break;
      element = parent;
    }
    cards.push({ href, element, titleAnchor });
  }
  return cards;
}

export function makeResolver(baseUrl: string) {
  return (href: string): string | undefined => {
    try {
      const url = new URL(href, baseUrl);
      if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
      url.hash = "";
      return url.toString();
    } catch {
      return undefined;
    }
  };
}

export { cheerio };
