import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

export function EtfHoldingsCard(_: {
  holdings: EtfBundle["holdings"];
  totalCount: number | null;
  refreshedAt: string | null;
}) {
  return null;
}
