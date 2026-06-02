"use client";

import { useRouter } from "next/navigation";
import { TickerSearch, type TickerSearchResult } from "@/components/ui/ticker-search";

// Wraps the shared TickerSearch so a selection navigates to that ticker's
// public scoring page. The symbol from search is already a valid exchange
// symbol (e.g. PEP, VOD.L); the page itself notFound()s if it has no score.
export function ScoringSearch() {
  const router = useRouter();
  function handleSelect(result: TickerSearchResult): void {
    router.push(`/scoring/${result.symbol.toUpperCase()}`);
  }
  return (
    <TickerSearch onSelect={handleSelect} placeholder="Search a share by symbol or name" />
  );
}
