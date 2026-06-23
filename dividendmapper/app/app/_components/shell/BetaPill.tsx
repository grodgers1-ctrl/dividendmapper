"use client";

// Day 8 brand: consolidate the per-chip β superscript into one shared pill
// next to the page title. Clicking opens a popover explaining the
// methodology + linking to the public /scoring-methodology page. Same pill
// renders on /app/dashboard and /app/portfolio/scoring via PageHeader's
// betaPill prop.

import Link from "next/link";
import { Popover } from "@base-ui/react/popover";

export function BetaPill() {
  return (
    <Popover.Root>
      <Popover.Trigger
        className="inline-flex items-center rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Scoring beta details"
      >
        Scoring · beta
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6}>
          <Popover.Popup className="z-50 max-w-xs rounded-md border border-[var(--border-subtle)] bg-[var(--surface)] p-3 text-sm text-[var(--text)] shadow-lg">
            <p className="leading-relaxed">
              Scores are in beta. The methodology is evolving and weights are
              tuned monthly.
            </p>
            <p className="mt-2">
              <Link
                href="/scoring-methodology"
                className="text-[var(--brand)] hover:underline"
              >
                How scores are calculated →
              </Link>
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
