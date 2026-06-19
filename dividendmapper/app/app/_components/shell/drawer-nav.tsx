"use client";

import Link from "next/link";
import { useDrawerCollapsed } from "./drawer-collapsed-context";
import type { NavItem } from "./nav-items";

// Pure props-driven nav list. The parent <Drawer> reads `usePathname()` and
// passes `currentPath` in — keeps this component trivially testable.
//
// Active rule mirrors the existing AppNav: exact items light up only on a
// literal match (Ledger doesn't follow you into /portfolio/scoring); other
// items also light up on sub-paths.
export function DrawerNav({
  items,
  currentPath,
}: {
  items: readonly NavItem[];
  currentPath: string;
}) {
  const { collapsed } = useDrawerCollapsed();

  return (
    <nav
      aria-label="Application navigation"
      className="flex-1 overflow-y-auto p-3 space-y-1"
    >
      {items.map((item) => {
        const active = item.exact
          ? currentPath === item.href
          : currentPath === item.href ||
            currentPath.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-active={active ? "true" : undefined}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            className={
              active
                ? "flex h-9 items-center gap-3 rounded-md bg-[var(--surface-2)] px-3 text-sm font-medium text-[var(--text)]"
                : "flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium text-[var(--text-muted)] hover:bg-[var(--surface-2)]/60 hover:text-[var(--text)] transition-colors"
            }
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
