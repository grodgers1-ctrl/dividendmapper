"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useDrawerCollapsed } from "./drawer-collapsed-context";

// Small borderless chevron button pinned to the drawer's bottom-right corner.
// Pivots between « and » depending on state. State persistence lives in the
// context (localStorage + cross-tab via storage event).
export function DrawerCollapseToggle() {
  const { collapsed, setCollapsed } = useDrawerCollapsed();
  return (
    <div className="flex shrink-0 justify-end px-2 py-1">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        aria-label={collapsed ? "Expand drawer" : "Collapse drawer"}
        aria-pressed={collapsed}
        title={collapsed ? "Expand drawer" : "Collapse drawer"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-faint)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        )}
      </button>
    </div>
  );
}
