"use client";

import { useState } from "react";
import { PersonalisationWizard } from "@/app/app/portfolio/_components/personalisation-wizard";
import type { UserPreferences } from "@/lib/scoring/preferences";

// Lets any tier open the personalisation wizard to set or revisit answers.
export function AccountWizardEntry({ initial }: { initial: UserPreferences | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        {initial?.wizard_completed_at ? "Update your preferences" : "Personalise your view"}
      </button>
      <PersonalisationWizard open={open} onOpenChange={setOpen} initial={initial} />
    </>
  );
}
