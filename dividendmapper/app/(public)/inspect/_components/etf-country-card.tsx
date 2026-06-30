import { ConcentricDonut } from "@/components/charts/concentric-donut";
import type { EtfBundle } from "@/lib/etf/load-etf-bundle";

type C = EtfBundle["countries"][number];

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

export function EtfCountryCard({ countries }: { countries: C[] }) {
  if (countries.length === 0) return null;
  // Single-country ETFs (e.g. UK-only) — hide the card; the donut would be
  // a featureless full ring.
  if (countries.length === 1) return null;

  const top = countries.slice(0, 8);
  const tail = countries.slice(8).reduce((acc, c) => acc + c.weight_pct, 0);
  const segs = [
    ...top.map((c, i) => ({
      label: c.country,
      value: c.weight_pct,
      color: PAL[i % PAL.length],
    })),
    ...(tail > 0.01
      ? [{ label: "Smaller regions", value: tail, color: TAIL_COLOUR }]
      : []),
  ];

  return (
    <section className="rounded-lg border border-border-subtle bg-surface p-4">
      <h3 className="mb-3 text-sm font-medium">Country / region weighting</h3>
      <ConcentricDonut
        segments={segs}
        centreLabel={String(segs.length)}
        centreSubLabel="Regions"
      />
    </section>
  );
}
