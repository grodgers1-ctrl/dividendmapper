"use client";
import { useState } from "react";

export interface CompareRow {
  label: string;
  a: string;
  b: string;
}

export function CompareDifferencesToggle({ rows }: { rows: CompareRow[] }) {
  const [diffOnly, setDiffOnly] = useState(false);
  const shown = diffOnly ? rows.filter((r) => r.a !== r.b) : rows;
  return (
    <div>
      <label className="mb-3 inline-flex items-center gap-2 text-xs text-text-muted">
        <input
          type="checkbox"
          checked={diffOnly}
          onChange={(e) => setDiffOnly(e.target.checked)}
          className="accent-emerald-500"
        />
        Show only differences
      </label>
      <table className="w-full text-sm">
        <thead className="text-xs text-text-muted">
          <tr>
            <th className="py-2 text-left font-normal">Field</th>
            <th className="py-2 text-right font-normal">A</th>
            <th className="py-2 text-right font-normal">B</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.label} className="border-t border-border-subtle">
              <td className="py-1.5">{r.label}</td>
              <td className="py-1.5 text-right font-mono tabular-nums">{r.a}</td>
              <td className="py-1.5 text-right font-mono tabular-nums">{r.b}</td>
            </tr>
          ))}
          {shown.length === 0 && (
            <tr>
              <td colSpan={3} className="py-3 text-center text-xs text-text-muted">
                No differences across these fields.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
