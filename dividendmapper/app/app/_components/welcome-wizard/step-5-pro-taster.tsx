"use client";

export function Step5ProTaster({
  onFinish,
  onDismissPermanent,
  onBack,
}: {
  onFinish: () => void;
  onDismissPermanent: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <h2 id="welcome-wizard-step-5-headline">Here&apos;s what Pro adds.</h2>
      <button type="button" onClick={onFinish}>Finish</button>
      <button type="button" onClick={onDismissPermanent}>Don&apos;t show this again</button>
      <button type="button" onClick={onBack}>Back</button>
    </div>
  );
}
