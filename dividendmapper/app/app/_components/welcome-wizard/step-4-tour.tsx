"use client";

export function Step4Tour({
  onAdvance,
  onBack,
}: {
  onAdvance: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-4-headline">A few things worth knowing.</h2>
      <button type="button" onClick={onAdvance}>Continue</button>
      <button type="button" onClick={onBack}>Back</button>
    </div>
  );
}
