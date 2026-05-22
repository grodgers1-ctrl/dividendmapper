"use client";

import { useState } from "react";

type Code = {
  id: string;
  code: string;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
};

export function FoundingCodeCard({ code }: { code: Code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers or HTTP context. Falling back would require a hidden
      // input + execCommand; skipping for now since prod is HTTPS and modern.
    }
  };

  if (code.redeemed_at) {
    const redeemedDate = new Date(code.redeemed_at).toLocaleDateString(
      "en-GB",
      { day: "numeric", month: "long", year: "numeric" },
    );
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
        <span className="font-mono text-sm text-muted-foreground line-through">
          {code.code}
        </span>
        <span className="text-xs text-muted-foreground">
          Redeemed on {redeemedDate}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
      <span className="font-mono text-sm font-medium text-foreground">
        {code.code}
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
