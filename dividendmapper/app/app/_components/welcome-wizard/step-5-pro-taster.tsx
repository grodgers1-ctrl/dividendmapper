"use client";

import Link from "next/link";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";

const TILES = [
  { title: "Resilience scores", caption: "Every holding, every night." },
  { title: "Quality, Trim, Risk", caption: "Scores on every equity holding." },
  { title: "Dividend calendar", caption: "18 months out, projected." },
  { title: "Unlimited holdings and watchlist", caption: "With threshold alerts." },
] as const;

export interface Step5ProTasterProps {
  onFinish: () => void;
  onDismissPermanent: () => void;
  onBack: () => void;
}

export function Step5ProTaster({ onFinish, onDismissPermanent, onBack }: Step5ProTasterProps) {
  const handlePricing = () => {
    captureClientEvent("welcome_wizard_pricing_clicked", {});
    onFinish();
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="welcome-wizard-step-5-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          When you&apos;re ready, here&apos;s what Pro adds.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No rush. Free has plenty until you need these.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {TILES.map((t) => (
          <div
            key={t.title}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--canvas)] p-3"
          >
            <p className="text-sm font-medium text-[var(--text)]">{t.title}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t.caption}</p>
          </div>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-xs text-[var(--text-muted)] hover:underline"
          >
            Back
          </button>
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              target="_blank"
              rel="noopener"
              onClick={handlePricing}
              className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--canvas)]"
            >
              See pricing
            </Link>
            <button
              type="button"
              onClick={onFinish}
              className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Finish
            </button>
          </div>
        </div>
        <div>
          <button
            type="button"
            onClick={onDismissPermanent}
            className="text-xs text-[var(--text-muted)] hover:underline"
          >
            Don&apos;t show this again
          </button>
          <p className="mt-0.5 text-[10px] text-[var(--text-muted)]">
            This is separate from your email preferences.
          </p>
        </div>
      </div>
    </div>
  );
}
