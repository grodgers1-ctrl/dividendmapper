"use client";

import { WelcomeWizard } from "./welcome-wizard";

export interface WelcomeWizardIslandProps {
  shouldShow: boolean;
  initialHoldingsCount: number;
}

export function WelcomeWizardIsland({ shouldShow, initialHoldingsCount }: WelcomeWizardIslandProps) {
  if (!shouldShow) return null;
  return <WelcomeWizard initialHoldingsCount={initialHoldingsCount} />;
}
