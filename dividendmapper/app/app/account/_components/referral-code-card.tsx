"use client";

import { useState } from "react";

type ReferralCodeCardProps = {
  url: string;
  redeemed: boolean;
  redeemedAt: string | null;
};

export function ReferralCodeCard({
  url,
  redeemed,
  redeemedAt,
}: ReferralCodeCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers or HTTP context. Falling back would require a hidden
      // input + execCommand; skipping for now since prod is HTTPS and modern.
    }
  };

  if (redeemed) {
    const redeemedDate = redeemedAt
      ? new Date(redeemedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : null;
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
        <span className="truncate font-mono text-sm text-muted-foreground line-through">
          {url}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {redeemedDate ? `Redeemed on ${redeemedDate}` : "Redeemed"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="truncate font-mono text-sm font-medium text-foreground">
        {url}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        aria-live="polite"
        className="inline-flex h-7 shrink-0 items-center justify-center rounded-md border border-border bg-secondary px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary/80"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
