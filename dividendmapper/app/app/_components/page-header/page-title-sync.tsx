"use client";

import { useEffect } from "react";
import { pageTitleStore } from "./page-title-store";

// Tiny side-effect-only island. Mounted by <PageHeader>; pushes the title
// into the external store on every change. Returns null — the rendering
// happens up in <TopBar> via usePageTitle().
//
// Cleanup clears the title so a route that has no <PageHeader> doesn't
// inherit the previous page's title.
export function PageTitleSync({ title }: { title: string }) {
  useEffect(() => {
    pageTitleStore.set(title);
    return () => {
      pageTitleStore.set("");
    };
  }, [title]);
  return null;
}
