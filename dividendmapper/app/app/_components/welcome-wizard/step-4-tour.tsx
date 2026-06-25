"use client";

import Link from "next/link";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";

interface TourCard {
  key: "income" | "scoring" | "vehicles";
  href: string;
  title: string;
  caption: string;
}

const CARDS: TourCard[] = [
  {
    key: "income",
    href: "/app/portfolio#income-chart",
    title: "Your income chart",
    caption: "Projected income per month lives under your Ledger.",
  },
  {
    key: "scoring",
    href: "/scoring",
    title: "Public scoring",
    caption: "Per-ticker resilience pages, free. No signup needed for any ticker we cover.",
  },
  {
    key: "vehicles",
    href: "/income-vehicles",
    title: "Income vehicle hub",
    caption: "REITs, BDCs, UK REITs. Scored and searchable.",
  },
];

export interface Step4TourProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function Step4Tour({ onAdvance, onBack }: Step4TourProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2
          id="welcome-wizard-step-4-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          A few things worth knowing while you&apos;re here.
        </h2>
      </div>

      <div className="flex flex-col gap-2">
        {CARDS.map((c) => (
          <Link
            key={c.key}
            href={c.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => captureClientEvent("welcome_wizard_tour_card_clicked", { card_key: c.key })}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--canvas)] p-3 hover:bg-[var(--surface)]"
          >
            <p className="text-sm font-medium text-[var(--text)]">{c.title}</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{c.caption}</p>
          </Link>
        ))}
      </div>

      <div className="mt-auto flex items-center justify-between">
        <button type="button" onClick={onBack} className="text-xs text-[var(--text-muted)] hover:underline">
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
