"use client";

export interface Step1WelcomeProps {
  onAdvance: () => void;
  onSkipTour: () => void;
}

export function Step1Welcome({ onAdvance, onSkipTour }: Step1WelcomeProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          id="welcome-wizard-step-1-headline"
          className="font-display text-xl font-semibold text-[var(--text)]"
        >
          Welcome to DividendMapper.
        </h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Let&apos;s get you to your first Quality score. Takes about a minute. You can close this any time and it&apos;ll be here when you&apos;re back.
        </p>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <button
          type="button"
          onClick={onSkipTour}
          className="text-xs text-[var(--text-muted)] hover:underline"
        >
          Skip the tour
        </button>
        <button
          type="button"
          onClick={onAdvance}
          className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Let&apos;s go
        </button>
      </div>
    </div>
  );
}
