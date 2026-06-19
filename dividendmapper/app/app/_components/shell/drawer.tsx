"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DrawerNav } from "./drawer-nav";
import { DrawerFooter } from "./drawer-footer";
import { DrawerCollapseToggle } from "./drawer-collapse-toggle";
import { useDrawerCollapsed } from "./drawer-collapsed-context";
import {
  DEFAULT_NAV_ITEMS,
  filterNavItems,
  type TierLike,
} from "./nav-items";

// Fixed-left sidebar. Toggles between w-64 (expanded) and w-16 (icon rail)
// with a 200ms width transition; motion-reduce strips the animation.
// Brand header height matches <TopBar> so the top edges align across the
// drawer/main seam.
//
// `desktop` = true renders the persistent md:flex sidebar; `desktop` = false
// is used inside <MobileDrawerOverlay> — same internals, no responsive
// hiding, no collapse toggle (mobile is full-width, not collapsible).
export function Drawer({
  email,
  tier,
  isAdmin,
  desktop = true,
  onNavigate,
}: {
  email: string;
  tier: TierLike;
  isAdmin: boolean;
  desktop?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const { collapsed } = useDrawerCollapsed();
  const items = filterNavItems(DEFAULT_NAV_ITEMS, { tier, isAdmin });
  const isCollapsed = desktop ? collapsed : false;

  const width = isCollapsed ? "w-16" : "w-64";
  const responsive = desktop ? "hidden md:flex" : "flex";

  return (
    <aside
      data-collapsed={isCollapsed ? "true" : "false"}
      className={`${width} ${responsive} h-full shrink-0 flex-col overflow-hidden border-r border-[var(--border-subtle)] bg-[var(--surface)] transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none`}
      aria-label="Primary"
    >
      <div
        className={
          isCollapsed
            ? "flex h-14 shrink-0 items-center justify-center border-b border-[var(--border-subtle)] px-2"
            : "flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border-subtle)] px-4"
        }
      >
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
          {!isCollapsed && <span>DividendMapper</span>}
        </Link>
      </div>

      <DrawerNav
        items={items}
        currentPath={pathname}
        onNavigate={onNavigate}
      />

      <DrawerFooter email={email} />

      {desktop && <DrawerCollapseToggle />}
    </aside>
  );
}
