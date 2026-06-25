"use client";

// Client wrapper owning the toggle + filter state for /app/calendar.
// Day 2 wires placeholder slots; Day 4 fills the chart + drill-down + filter.

import { useState } from "react";
import type { WrapperFilter } from "@/lib/portfolio/income-calendar";

export interface CalendarShellProps {
  priced: unknown;
  userId: string;
}

export function CalendarShell({ priced: _priced, userId: _userId }: CalendarShellProps) {
  const [netMode, setNetMode] = useState<"net" | "gross">("net");
  const [yearMode, setYearMode] = useState<"tax" | "calendar">("tax");
  const [_wrapperFilter, _setWrapperFilter] = useState<WrapperFilter>("all");

  return (
    <div className="flex flex-col gap-6">
      <div
        className="flex items-center justify-end gap-3"
        data-testid="calendar-header-toggles"
      >
        <ToggleGroup
          label="Net / Gross"
          value={netMode}
          options={[
            { value: "net", label: "Net" },
            { value: "gross", label: "Gross" },
          ]}
          onChange={(v) => setNetMode(v as "net" | "gross")}
        />
        <ToggleGroup
          label="Tax year / Calendar year"
          value={yearMode}
          options={[
            { value: "tax", label: "Tax year" },
            { value: "calendar", label: "Calendar year" },
          ]}
          onChange={(v) => setYearMode(v as "tax" | "calendar")}
        />
      </div>
      <div data-testid="calendar-wrapper-filter-slot" />
      <div data-testid="calendar-hero-kpi-slot" />
      <div data-testid="calendar-chart-slot" />
      <div data-testid="calendar-drilldown-slot" />
    </div>
  );
}

function ToggleGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex overflow-hidden rounded-md border border-[var(--border-subtle)]"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`px-3 py-1 text-xs ${
            o.value === value
              ? "bg-[var(--brand)] text-white"
              : "bg-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
