"use client";

import { usePathname } from "next/navigation";
import { normalizeTicker } from "@/lib/scoring/load-score";

// not-found.tsx receives no props, so the attempted ticker is read from the
// path on the client (the documented pattern). Falls back to "that share" when
// the segment isn't a well-formed ticker.
export function MissingTicker() {
  const pathname = usePathname();
  const segment = pathname?.split("/").filter(Boolean).pop() ?? "";
  const ticker = normalizeTicker(segment);
  return <>{ticker ?? "that share"}</>;
}
