"use client";

import { useLocale } from "@/lib/locale/context";
import { LocaleToggle } from "@/components/locale-toggle";

export interface Step2LocaleProps {
  onAdvance: () => void;
  onBack: () => void;
}

export function Step2Locale({ onAdvance, onBack }: Step2LocaleProps) {
  const { config } = useLocale();
  const label = config.locale === "us" ? "US" : "UK";

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="welcome-wizard-step-2-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          Heads up. This toggle controls the wrappers and currency we show.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Set to {label} based on your browser. Switch any time from the header, or right here.
        </p>
      </div>

      <div className="flex justify-center">
        <LocaleToggle />
      </div>

      <div className="mt-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="text-xs text-[var(--text-muted)] hover:underline"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
