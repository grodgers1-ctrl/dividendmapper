"use client";

export function Step2Locale({
  onAdvance,
  onBack,
}: {
  onAdvance: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-2-headline">Heads up.</h2>
      <button type="button" onClick={onAdvance}>Got it</button>
      <button type="button" onClick={onBack}>Back</button>
    </div>
  );
}
