"use client";

// Mirror of ScoringSearch: wraps the shared TickerSearch so a selection
// navigates to that ticker's Inspect page.

import { useRouter } from "next/navigation";
import { TickerSearch, type TickerSearchResult } from "@/components/ui/ticker-search";

export function InspectSearch() {
  const router = useRouter();
  function handleSelect(result: TickerSearchResult): void {
    router.push(`/inspect/${result.symbol.toUpperCase()}`);
  }
  return (
    <TickerSearch onSelect={handleSelect} placeholder="Search a share by symbol or name" />
  );
}
