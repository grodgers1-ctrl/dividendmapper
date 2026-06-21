"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export const DRAWER_COLLAPSED_STORAGE_KEY = "dm.drawer.collapsed";

type DrawerCollapsedValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
};

// Stored format is the literal string 'true' or 'false' (no JSON) — easier
// to inspect in devtools and bulletproof against parse errors. Anything
// else is treated as missing → default expanded.
function parseStored(raw: string | null | undefined): boolean | null {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

// Same-tab listeners. Storage events only fire in *other* tabs when
// localStorage changes, so we have to broadcast manually to React inside
// the writing tab.
type Listener = () => void;
const sameTabListeners = new Set<Listener>();

function notifyLocal() {
  for (const l of sameTabListeners) l();
}

function subscribe(callback: Listener) {
  if (typeof window === "undefined") return () => {};
  sameTabListeners.add(callback);
  function handler(event: StorageEvent) {
    if (event.key === DRAWER_COLLAPSED_STORAGE_KEY) callback();
  }
  window.addEventListener("storage", handler);
  return () => {
    sameTabListeners.delete(callback);
    window.removeEventListener("storage", handler);
  };
}

// Default = expanded, no-op setter. `useDrawerCollapsed()` outside a provider
// returns this so sibling unit tests don't need to wrap in the provider.
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
  // useSyncExternalStore subscribes to localStorage + same-tab broadcasts.
  // SSR renders with the server snapshot (initialCollapsed); on hydration,
  // the client snapshot kicks in. Storage events from other tabs are
  // forwarded by the subscribe handler. Same-tab writes (setCollapsed below)
  // call notifyLocal() to re-fire the subscription.
  //
  // initialCollapsed doubles as the fallback when localStorage is empty —
  // SSR-rendered apps can opt-in to a server-provided default (e.g. read
  // from a cookie) without needing a separate prop.
  const getClientSnapshot = useCallback(() => {
    if (typeof window === "undefined") return initialCollapsed;
    return (
      parseStored(window.localStorage.getItem(DRAWER_COLLAPSED_STORAGE_KEY)) ??
      initialCollapsed
    );
  }, [initialCollapsed]);

  const getServerSnapshot = useCallback(
    () => initialCollapsed,
    [initialCollapsed],
  );

  const collapsed = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  const setCollapsed = useCallback((next: boolean) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        DRAWER_COLLAPSED_STORAGE_KEY,
        next ? "true" : "false",
      );
    } catch {
      // localStorage can throw (quota, Safari private mode). With the write
      // failed there's nothing to broadcast; in-memory state stays in sync
      // on next render via the snapshot read.
    }
    notifyLocal();
  }, []);

  const value = useMemo(
    () => ({ collapsed, setCollapsed }),
    [collapsed, setCollapsed],
  );

  return (
    <DrawerCollapsedContext.Provider value={value}>
      {children}
    </DrawerCollapsedContext.Provider>
  );
}

export function useDrawerCollapsed(): DrawerCollapsedValue {
  return useContext(DrawerCollapsedContext);
}
