"use client";

export function Step3AddHolding({
  existingHoldingsCount: _existingHoldingsCount,
  onAdvance,
  onBack,
}: {
  existingHoldingsCount: number;
  onAdvance: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-3-headline">Add a holding.</h2>
      <button type="button" onClick={onAdvance}>Add holding</button>
      <button type="button" onClick={onBack}>Back</button>
    </div>
  );
}
