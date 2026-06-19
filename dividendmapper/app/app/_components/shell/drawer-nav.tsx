"use client";

import Link from "next/link";
import { Tooltip } from "@base-ui/react/tooltip";
import { PinIcon } from "./pin-icon";
import { useDrawerCollapsed } from "./drawer-collapsed-context";
import type { NavItem } from "./nav-items";

// Pure props-driven nav list. The parent <Drawer> reads `usePathname()` and
// passes `currentPath` in — keeps this component trivially testable.
//
// Active rule mirrors the existing AppNav: exact items light up only on a
// literal match (Ledger doesn't follow you into /portfolio/scoring); other
// items also light up on sub-paths.
//
// Collapsed mode renders an icon rail (w-16): items centred, labels hidden
// (sr-only — still accessible), tooltips replace inline labels. The active
// pin marker right-aligns when expanded and shows as a centred dot when
// collapsed.
export function DrawerNav({
  items,
  currentPath,
  onNavigate,
}: {
  items: readonly NavItem[];
  currentPath: string;
  onNavigate?: () => void;
}) {
  const { collapsed } = useDrawerCollapsed();

  return (
    <Tooltip.Provider delay={200} closeDelay={0}>
      <nav
        aria-label="Application navigation"
        className="flex-1 space-y-1 overflow-y-auto p-3"
      >
        {items.map((item) => {
          const active = item.exact
            ? currentPath === item.href
            : currentPath === item.href ||
              currentPath.startsWith(`${item.href}/`);
          const Icon = item.icon;

          const baseClass = active
            ? "relative flex h-9 items-center rounded-md bg-[var(--surface-2)] text-sm font-medium text-[var(--text)]"
            : "relative flex h-9 items-center rounded-md text-sm font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]/60 hover:text-[var(--text)]";
          const layoutClass = collapsed
            ? " justify-center px-0"
            : " gap-3 px-3";

          const link = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              data-active={active ? "true" : undefined}
              aria-current={active ? "page" : undefined}
              className={baseClass + layoutClass}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {/* Pin marker — right-aligned on the expanded active row. */}
              {!collapsed && active && (
                <PinIcon
                  className="h-3.5 w-3.5 shrink-0 text-[var(--brand)]"
                  aria-hidden
                />
              )}
              {/* Collapsed-mode active marker: small centred dot below the
                  icon. Subtle — relies on bg-surface-2 to do the heavy lift. */}
              {collapsed && active && (
                <span
                  aria-hidden
                  className="absolute bottom-1 h-1 w-1 rounded-full bg-[var(--brand)]"
                />
              )}
            </Link>
          );

          if (!collapsed) {
            return <div key={item.href}>{link}</div>;
          }

          // Collapsed: wrap each row in a tooltip so the icon-rail keeps the
          // label discoverable. Tooltips mount only in this branch.
          return (
            <Tooltip.Root key={item.href}>
              <Tooltip.Trigger
                render={
                  <div className="relative">{link}</div>
                }
              />
              <Tooltip.Portal>
                <Tooltip.Positioner side="right" sideOffset={8}>
                  <Tooltip.Popup className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-xs font-medium text-[var(--text)] shadow-sm">
                    {item.label}
                  </Tooltip.Popup>
                </Tooltip.Positioner>
              </Tooltip.Portal>
            </Tooltip.Root>
          );
        })}
      </nav>
    </Tooltip.Provider>
  );
}
