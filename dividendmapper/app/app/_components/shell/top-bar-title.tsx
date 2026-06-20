"use client";

import { usePageTitle } from "../page-header/use-page-title";

// Reads the broadcast title from <PageHeader>. Empty on first paint (SSR
// snapshot is ""); the client hydrates with the real title within a tick.
// Visually muted-to-strong so the contrast pop happens on the page body's
// h1, not here.
export function TopBarTitle() {
  const title = usePageTitle();
  return (
    <span className="truncate text-[15px] font-medium leading-5 text-[var(--text)]">
      {title}
    </span>
  );
}
