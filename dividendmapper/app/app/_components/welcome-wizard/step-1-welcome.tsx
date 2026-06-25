"use client";

export function Step1Welcome({
  onAdvance,
  onSkipTour,
}: {
  onAdvance: () => void;
  onSkipTour: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-1-headline">Welcome to DividendMapper.</h2>
      <button type="button" onClick={onAdvance}>Let&apos;s go</button>
      <button type="button" onClick={onSkipTour}>Skip the tour</button>
    </div>
  );
}
