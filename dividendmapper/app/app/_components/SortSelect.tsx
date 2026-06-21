"use client";

// Day 8 token pass. Replaces the native <select> in holdings-table.tsx with
// a base-ui Select that styles via tokens — bg-surface, border-subtle,
// rounded-md, hover-surface-2 on rows. Identical state contract: caller
// owns the value + onChange, so localStorage persistence in holdings-table
// keeps working unchanged.

import { Select } from "@base-ui/react/select";
import { ChevronDown } from "lucide-react";

export interface SortSelectOption {
  value: string;
  label: string;
}

export interface SortSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<SortSelectOption>;
}

export function SortSelect({ id, value, onChange, options }: SortSelectProps) {
  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (typeof next === "string") onChange(next);
      }}
    >
      <Select.Trigger
        id={id}
        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Select.Value />
        <Select.Icon className="text-[var(--text-muted)]">
          <ChevronDown className="h-3.5 w-3.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4}>
          <Select.Popup className="z-50 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] py-1 shadow-lg">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--text)] data-[highlighted]:bg-[var(--surface-2)]"
              >
                <Select.ItemText>{opt.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
