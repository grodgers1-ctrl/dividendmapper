import { ConcentricDonut } from "@/components/charts/concentric-donut";
import type { OverlapResult } from "@/lib/etf/compute-overlap";

export function CompareOverlapDonut({
  overlap,
  aTicker,
  bTicker,
}: {
  overlap: OverlapResult;
  aTicker: string;
  bTicker: string;
}) {
  const sharedTotal = overlap.sharedWeightA + overlap.sharedWeightB;
  const everythingTotal = sharedTotal + overlap.onlyAWeight + overlap.onlyBWeight;
  const sharedPct =
    everythingTotal > 0 ? Math.round((sharedTotal / everythingTotal) * 100) : 0;

  // Hide the donut for the no-data case (both ETFs have empty holdings —
  // e.g. two bond ETFs). The page section still renders the heading.
  if (everythingTotal === 0) {
    return (
      <p className="text-sm text-muted-foreground">No holdings cached for one or both ETFs.</p>
    );
  }

  return (
    <ConcentricDonut
      centreLabel={`${sharedPct}%`}
      centreSubLabel="SHARED"
      segments={[
        { label: "Shared", value: sharedTotal, color: "#22c55e" },
        { label: `${aTicker} only`, value: overlap.onlyAWeight, color: "#475569" },
        { label: `${bTicker} only`, value: overlap.onlyBWeight, color: "#334155" },
      ]}
    />
  );
}
