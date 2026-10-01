"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

import { useModules } from "@/components/shell/ModulesProvider";

/**
 * A link that only exists when the module behind it is switched on.
 *
 * Screens across Raahi point at each other — "ask an advisor", "see the
 * programme catalogue", "track my application". On a deployment that does not
 * run the target module, that link would open a page that refuses to work. This
 * renders nothing instead, so what you see is always what this deployment can
 * actually do.
 */
export function ModuleLink({
  id,
  ...rest
}: { id: string } & ComponentProps<typeof Link>) {
  const { modules } = useModules();
  const enabled = modules.some((module) => module.id === id);
  if (!enabled) return null;
  return <Link {...rest} />;
}
