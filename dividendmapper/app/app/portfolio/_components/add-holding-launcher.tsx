"use client";

import { useState } from "react";
import { AddHoldingModal } from "./add-holding-modal";

export function AddHoldingLauncher({
  atFreeLimit,
}: {
  atFreeLimit: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (atFreeLimit) {
    return (
      <div className="text-right text-xs leading-relaxed">
        <p className="font-display text-sm font-semibold text-foreground">
          Free tier full
        </p>
        <p className="mt-0.5 text-muted-foreground">
          Upgrade to Pro for unlimited holdings.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
      >
        Add holding
      </button>
      <AddHoldingModal open={open} onOpenChange={setOpen} />
    </>
  );
}
