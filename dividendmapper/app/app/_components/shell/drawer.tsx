"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DrawerNav } from "./drawer-nav";
import { DrawerFooter } from "./drawer-footer";
import { useDrawerCollapsed } from "./drawer-collapsed-context";
import {
  DEFAULT_NAV_ITEMS,
  filterNavItems,
  type TierLike,
} from "./nav-items";

// Fixed-left sidebar. `w-64` for v1 — collapse toggle to `w-16` is Day 3.
// Brand header height matches <TopBar> so the top edges align across the
// drawer/main seam.
export function Drawer({
  email,
  tier,
  isAdmin,
}: {
  email: string;
  tier: TierLike;
  isAdmin: boolean;
}) {
  const pathname = usePathname() ?? "";
  const { collapsed } = useDrawerCollapsed();
  const items = filterNavItems(DEFAULT_NAV_ITEMS, { tier, isAdmin });

  return (
    <aside
      data-collapsed={collapsed ? "true" : "false"}
      className={
        (collapsed ? "w-16" : "w-64") +
        " hidden h-full shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface)] md:flex"
      }
      aria-label="Primary"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4">
        <Link
          href="/app/dashboard"
          aria-label="DividendMapper home"
          className="flex items-center gap-2 font-display text-base font-semibold tracking-tight text-[var(--text)]"
        >
          <Image
            src="/logo-pin.png"
            alt=""
            width={24}
            height={24}
            priority
            aria-hidden
            className="h-6 w-6"
          />
          {!collapsed && <span>DividendMapper</span>}
        </Link>
      </div>

      <DrawerNav items={items} currentPath={pathname} />

      <DrawerFooter email={email} />
    </aside>
  );
}
