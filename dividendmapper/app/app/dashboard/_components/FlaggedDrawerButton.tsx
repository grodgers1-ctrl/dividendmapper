"use client";

import { useState } from "react";
import { ScoreDrawer } from "@/app/app/portfolio/_components/score-drawer";

// Tiny client island for the FlaggedHoldingCard's "View full breakdown" CTA.
// Day 6 plan opens the drawer on the Risk breakdown — the card highlights
// the highest-Risk holding, so the drawer should reinforce that.

export interface FlaggedDrawerButtonProps {
  ticker: string;
  isBeta: boolean;
}

export function FlaggedDrawerButton({ ticker, isBeta }: FlaggedDrawerButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm font-medium text-[var(--brand)] hover:underline"
      >
        View full breakdown →
      </button>
      {open && (
        <ScoreDrawer
          ticker={ticker}
          scoreType="risk"
          open={open}
          onOpenChange={setOpen}
          isBeta={isBeta}
        />
      )}
    </>
  );
}
