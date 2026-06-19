"use client";

import { createContext, useContext, useMemo, useState } from "react";

type DrawerCollapsedValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
};

// Default = expanded, no-op setter. `useDrawerCollapsed()` outside a provider
// returns this so sibling unit tests don't need to wrap in the provider.
// Day 3 swaps the in-memory state for a localStorage round-trip + storage
// event sync; the value shape is stable here.
const NOOP: DrawerCollapsedValue = {
  collapsed: false,
  setCollapsed: () => {},
};

const DrawerCollapsedContext = createContext<DrawerCollapsedValue>(NOOP);

export function DrawerCollapsedProvider({
  children,
  initialCollapsed = false,
}: {
  children: React.ReactNode;
  initialCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const value = useMemo(() => ({ collapsed, setCollapsed }), [collapsed]);
  return (
    <DrawerCollapsedContext.Provider value={value}>
      {children}
    </DrawerCollapsedContext.Provider>
  );
}

export function useDrawerCollapsed(): DrawerCollapsedValue {
  return useContext(DrawerCollapsedContext);
}
