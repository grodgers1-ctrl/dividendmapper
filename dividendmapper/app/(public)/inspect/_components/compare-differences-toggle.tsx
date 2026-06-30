"use client";
import { useState } from "react";
import { HoldingLogo } from "@/app/app/portfolio/_components/holding-logo";
import { RowSparkline } from "@/app/app/portfolio/_components/row-sparkline";
import type { SparklineSeries } from "@/lib/portfolio/load-sparkline-series";

export interface CompareRow {
  label: string;
  a: string;
  b: string;
}

interface Props {
  rows: CompareRow[];
  aTicker?: string;
  bTicker?: string;
  aName?: string;
  bName?: string;
  aSeries?: SparklineSeries | null;
  bSeries?: SparklineSeries | null;
}

function HeaderCell({ ticker, name }: { ticker?: string; name?: string }) {
  if (!ticker) return <>—</>;
  return (
    <div className="inline-flex items-center gap-2">
      <HoldingLogo ticker={ticker} name={name} size={20} />
      <span className="font-mono text-foreground">{ticker}</span>
    </div>
  );
}

export function CompareDifferencesToggle({
  rows,
  aTicker,
  bTicker,
  aName,
  bName,
  aSeries,
  bSeries,
}: Props) {
  const [diffOnly, setDiffOnly] = useState(false);
  const shown = diffOnly ? rows.filter((r) => r.a !== r.b) : rows;
  const showSparklines = aSeries !== undefined || bSeries !== undefined;
  return (
    <div>
      <label className="mb-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={diffOnly}
          onChange={(e) => setDiffOnly(e.target.checked)}
          className="accent-emerald-500"
        />
        Show only differences
      </label>
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className="py-2 text-left font-normal">Field</th>
            <th className="py-2 text-right font-normal">
              {aTicker ? <HeaderCell ticker={aTicker} name={aName} /> : "A"}
            </th>
            <th className="py-2 text-right font-normal">
              {bTicker ? <HeaderCell ticker={bTicker} name={bName} /> : "B"}
            </th>
          </tr>
        </thead>
        <tbody>
          {showSparklines && (
            <tr className="border-t border-border">
              <td className="py-2 text-xs uppercase tracking-wider text-muted-foreground">5Y</td>
              <td className="py-2">
                <div className="flex justify-end">
                  <RowSparkline
                    ticker={aTicker ?? "A"}
                    name={aName}
                    range="5Y"
                    series={aSeries ?? null}
                  />
                </div>
              </td>
              <td className="py-2">
                <div className="flex justify-end">
                  <RowSparkline
                    ticker={bTicker ?? "B"}
                    name={bName}
                    range="5Y"
                    series={bSeries ?? null}
                  />
                </div>
              </td>
            </tr>
          )}
          {shown.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right font-mono tabular-nums">{r.a}</td>
              <td className="py-1.5 text-right font-mono tabular-nums">{r.b}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={3} className="py-3 text-center text-xs text-muted-foreground">
                No differences across these fields.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
