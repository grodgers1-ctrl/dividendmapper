"use client";

import Link from "next/link";
import { useState } from "react";
import { AddHoldingModal } from "./add-holding-modal";
import {
  FREE_TIER_CAP_MESSAGE,
  FREE_TIER_CAP_TITLE,
} from "./free-tier-copy";

export function AddHoldingLauncher({
  atFreeLimit,
  pricingPublic,
}: {
  atFreeLimit: boolean;
  pricingPublic: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (atFreeLimit) {
    return (
      <div className="text-right text-xs leading-relaxed">
        <p className="font-display text-sm font-semibold text-foreground">
          {FREE_TIER_CAP_TITLE}
        </p>
        <p className="mt-0.5 text-muted-foreground">{FREE_TIER_CAP_MESSAGE}</p>
        {pricingPublic && (
          <Link
            href="/pricing"
            className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
          >
            Upgrade to Pro
            <span aria-hidden>→</span>
          </Link>
        )}
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
      <AddHoldingModal
        open={open}
        onOpenChange={setOpen}
        pricingPublic={pricingPublic}
      />
    </>
  );
}
