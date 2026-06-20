"use client";

import { useSyncExternalStore } from "react";
import { pageTitleStore } from "./page-title-store";

// Subscribes to the title broadcast. Returns "" on the server snapshot so
// SSR renders an empty TopBar slot; the client hydrates with the live title.
export function usePageTitle(): string {
  return useSyncExternalStore(
    pageTitleStore.subscribe,
    pageTitleStore.get,
    () => "",
  );
}
