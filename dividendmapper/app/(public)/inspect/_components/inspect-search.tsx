"use client";

// Mirror of ScoringSearch: wraps the shared TickerSearch so a selection
// navigates to that ticker's Inspect page. `hrefPrefix` lets the same
// component drive either the public /inspect surface or the in-app
// /app/inspect surface — selecting a ticker should keep the user on
// whichever side they came from.

import { useRouter } from "next/navigation";
import { TickerSearch, type TickerSearchResult } from "@/components/ui/ticker-search";

type Props = {
  hrefPrefix?: string;
};

export function InspectSearch({ hrefPrefix = "/inspect" }: Props) {
  const router = useRouter();
  function handleSelect(result: TickerSearchResult): void {
    router.push(`${hrefPrefix}/${result.symbol.toUpperCase()}`);
  }
  return (
    <TickerSearch onSelect={handleSelect} placeholder="Search a share by symbol or name" />
  );
}
