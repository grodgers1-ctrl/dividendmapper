"use client";

// Day 7 holding detail. Combobox of the user's holdings — typeahead-filtered
// (base-ui's built-in `<Combobox.Input>` filter); selecting a row pushes the
// browser to /app/portfolio/[selectedTicker]. Keyboard nav + Esc-to-close
// are handled by base-ui out of the box.

import { useRouter } from "next/navigation";
import { useId } from "react";
import { Combobox } from "@base-ui/react/combobox";
import { ChevronDown } from "lucide-react";

export interface HoldingPickerItem {
  ticker: string;
  name: string | null;
}

export interface HoldingPickerComboboxProps {
  currentTicker: string;
  holdings: ReadonlyArray<HoldingPickerItem>;
}

export function HoldingPickerCombobox({
  currentTicker,
  holdings,
}: HoldingPickerComboboxProps) {
  const router = useRouter();
  const id = useId();

  const items = holdings.map((h) => ({
    value: h.ticker,
    label: h.name ? `${h.ticker} · ${h.name}` : h.ticker,
  }));

  return (
    <Combobox.Root
      items={items}
      defaultValue={items.find((i) => i.value === currentTicker) ?? null}
      onValueChange={(item) => {
        if (item && typeof item === "object" && "value" in item) {
          const next = item.value;
          if (next && next !== currentTicker) router.push(`/app/portfolio/${next}`);
        }
      }}
    >
      <Combobox.InputGroup className="inline-flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] px-2 py-1.5 text-sm">
        <Combobox.Input
          id={id}
          placeholder={currentTicker}
          aria-label="Switch to another holding"
          className="w-32 bg-transparent font-mono text-sm text-[var(--text)] placeholder:text-[var(--text-muted)] focus:outline-none"
        />
        <Combobox.Trigger
          className="inline-flex h-5 w-5 items-center justify-center text-[var(--text-muted)] hover:text-[var(--text)]"
          aria-label="Open holdings"
        >
          <ChevronDown className="h-4 w-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup className="z-50 max-h-72 w-[min(20rem,calc(100vw-2rem))] overflow-auto rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] py-1 shadow-lg">
            <Combobox.List>
              {(item: { value: string; label: string }) => (
                <Combobox.Item
                  key={item.value}
                  value={item}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[var(--text)] data-[highlighted]:bg-[var(--surface-2)]"
                >
                  <span className="font-mono">{item.value}</span>
                  {item.label !== item.value && (
                    <span className="truncate text-[var(--text-muted)]">
                      {item.label.replace(`${item.value} · `, "")}
                    </span>
                  )}
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className="px-3 py-2 text-sm text-[var(--text-muted)]">
              No matching holdings.
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
