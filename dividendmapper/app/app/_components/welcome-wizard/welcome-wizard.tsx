"use client";

import { Dialog } from "@base-ui/react/dialog";
import { useEffect, useState, useCallback } from "react";
import { captureClientEvent } from "@/lib/analytics/posthog-capture";
import { Step1Welcome } from "./step-1-welcome";
import { Step2Locale } from "./step-2-locale";
import { Step3AddHolding } from "./step-3-add-holding";
import { Step4Tour } from "./step-4-tour";
import { Step5ProTaster } from "./step-5-pro-taster";

export type StepNumber = 1 | 2 | 3 | 4 | 5;

export interface WelcomeWizardProps {
  initialHoldingsCount: number;
}

async function postDismissal(reason: "completed" | "dismissed"): Promise<void> {
  try {
    await fetch("/api/onboarding/welcome", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
  } catch {
    // Optimistic: ignore failures. The next /app/* visit retries.
  }
}

export function WelcomeWizard({ initialHoldingsCount }: WelcomeWizardProps) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<StepNumber>(1);

  useEffect(() => {
    captureClientEvent("welcome_wizard_shown", { first_step: 1 });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        captureClientEvent("welcome_wizard_dismissed_session", { from_step: step });
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  const advance = useCallback(
    (to: StepNumber) => {
      captureClientEvent("welcome_wizard_step_advanced", { from_step: step, to_step: to });
      setStep(to);
    },
    [step],
  );

  const goBack = useCallback(() => {
    if (step === 1) return;
    const prev = (step - 1) as StepNumber;
    captureClientEvent("welcome_wizard_step_back", { from_step: step, to_step: prev });
    setStep(prev);
  }, [step]);

  const dismissPermanent = useCallback(
    (fromStep: StepNumber) => {
      captureClientEvent("welcome_wizard_dismissed_permanent", { from_step: fromStep });
      void postDismissal("dismissed");
      setOpen(false);
    },
    [],
  );

  const complete = useCallback(() => {
    captureClientEvent("welcome_wizard_completed", { path_through_steps: [1, 2, 3, 4, 5] });
    void postDismissal("completed");
    setOpen(false);
  }, []);

  const closeSession = useCallback(() => {
    captureClientEvent("welcome_wizard_dismissed_session", { from_step: step });
    setOpen(false);
  }, [step]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm motion-reduce:backdrop-blur-none" />
        <Dialog.Popup
          aria-labelledby={`welcome-wizard-step-${step}-headline`}
          className="fixed left-1/2 top-1/2 z-50 w-[min(480px,100vw)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface)] p-6 shadow-xl motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200 sm:max-h-[90vh] max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-t-lg max-sm:rounded-b-none max-sm:h-[90vh]"
        >
          <div className="flex items-center justify-between">
            <ol role="list" className="flex gap-2" aria-label="Progress">
              {[1, 2, 3, 4, 5].map((n) => (
                <li
                  key={n}
                  aria-current={n === step ? "step" : undefined}
                  className={`h-1.5 w-6 rounded-full ${
                    n === step ? "bg-[var(--brand)]" : "bg-[var(--border-subtle)]"
                  }`}
                />
              ))}
            </ol>
            <button
              type="button"
              aria-label="Close welcome tour"
              onClick={closeSession}
              className="text-[var(--text-muted)] hover:text-[var(--text)] text-lg leading-none"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 min-h-[280px]">
            {step === 1 && (
              <Step1Welcome onAdvance={() => advance(2)} onSkipTour={() => dismissPermanent(1)} />
            )}
            {step === 2 && (
              <Step2Locale onAdvance={() => advance(3)} onBack={goBack} />
            )}
            {step === 3 && (
              <Step3AddHolding
                existingHoldingsCount={initialHoldingsCount}
                onAdvance={() => advance(4)}
                onBack={goBack}
              />
            )}
            {step === 4 && (
              <Step4Tour onAdvance={() => advance(5)} onBack={goBack} />
            )}
            {step === 5 && (
              <Step5ProTaster
                onFinish={complete}
                onDismissPermanent={() => dismissPermanent(5)}
                onBack={goBack}
              />
            )}
          </div>

          <p className="sr-only" aria-live="polite">
            Step {step} of 5
          </p>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
