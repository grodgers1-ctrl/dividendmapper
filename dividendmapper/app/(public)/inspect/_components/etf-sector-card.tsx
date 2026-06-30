import { ConcentricDonut } from "@/components/charts/concentric-donut";
import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

type S = EtfBundle["sectors"][number];

// Brand emerald → supporting palette. Tail bucket gets the dimmest slate.
const PAL = [
  "#22c55e",
  "#818cf8",
  "#fbbf24",
  "#fb7185",
  "#94a3b8",
  "#0ea5e9",
  "#a78bfa",
  "#f472b6",
] as const;

const TAIL_COLOUR = "#475569";

export function EtfSectorCard({ sectors }: { sectors: S[] }) {
  if (!sectors.length) return null;

  const top = sectors.slice(0, 8);
  const tail = sectors.slice(8).reduce((acc, s) => acc + s.weight_pct, 0);
  const segs = [
    ...top.map((s, i) => ({
      label: s.sector,
      value: s.weight_pct,
      color: PAL[i % PAL.length],
    })),
    ...(tail > 0.01
      ? [{ label: "Smaller sectors", value: tail, color: TAIL_COLOUR }]
      : []),
  ];

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">Sector weighting</h3>
      <ConcentricDonut
        segments={segs}
        centreLabel={String(segs.length)}
        centreSubLabel="Sectors"
      />
    </section>
  );
}
