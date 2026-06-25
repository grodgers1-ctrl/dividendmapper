"use client";

import type { Locale, WrapperFilter } from "@/lib/portfolio/income-calendar";

interface ChipDef {
  value: WrapperFilter;
  label: string;
}

const UK_CHIPS: ReadonlyArray<ChipDef> = [
  { value: "all", label: "All" },
  { value: "isa", label: "ISA" },
  { value: "sipp", label: "SIPP" },
  { value: "gia", label: "GIA" },
];

const US_CHIPS: ReadonlyArray<ChipDef> = [
  { value: "all", label: "All" },
  { value: "401k", label: "401(k)" },
  { value: "ira", label: "IRA" },
  { value: "roth_ira", label: "Roth IRA" },
  { value: "brokerage", label: "Brokerage" },
];

export interface WrapperFilterRowProps {
  locale: Locale;
  value: WrapperFilter;
  onChange: (v: WrapperFilter) => void;
}

export function WrapperFilterRow({ locale, value, onChange }: WrapperFilterRowProps) {
  const chips = locale === "us" ? US_CHIPS : UK_CHIPS;
  return (
    <div className="flex gap-2 overflow-x-auto" role="toolbar" aria-label="Wrapper filter">
      {chips.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChange(c.value)}
          aria-pressed={c.value === value}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
            c.value === value
              ? "border-[var(--brand)] bg-[var(--brand)] text-white"
              : "border-[var(--border-subtle)] bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
