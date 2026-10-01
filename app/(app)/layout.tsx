import React from "react";

import AppShell, { type NavItem } from "@/components/shell/AppShell";
import { navModules } from "@/lib/modules/config";

/**
 * The bottom navigation is built here, on the server, from the module
 * registry. A deployment with only three modules enabled shows three — the app
 * shell is not a fixed list that has to be edited when the configuration
 * changes.
 */
function buildNav(): NavItem[] {
  const modules = navModules();
  return [
    { href: "/", icon: "🏠", title: { en: "Home", ur: "گھر", ps: "کور", hkp: "گھر" } },
    ...modules.map((module) => ({ href: module.href, icon: module.icon, title: module.title })),
    { href: "/more", icon: "☰", title: { en: "More", ur: "مزید", ps: "نور", hkp: "ہور" } },
  ];
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell nav={buildNav()}>{children}</AppShell>;
}
