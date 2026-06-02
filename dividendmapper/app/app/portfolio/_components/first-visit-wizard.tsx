"use client";

import { useState } from "react";
import { PersonalisationWizard } from "./personalisation-wizard";
import type { UserPreferences } from "@/lib/scoring/preferences";

// Auto-opens the wizard for a Pro user who has neither completed nor skipped it.
export function FirstVisitWizard({
  initial,
  autoOpen,
}: {
  initial: UserPreferences | null;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  return <PersonalisationWizard open={open} onOpenChange={setOpen} initial={initial} />;
}
