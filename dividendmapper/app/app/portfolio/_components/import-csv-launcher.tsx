"use client";

import { useState } from "react";
import { ImportCsvModal } from "./import-csv-modal";

// Pro-only entry point for the generic CSV holdings importer. The page gates
// rendering on tier, so this only mounts for Pro/Premium users.
export function ImportCsvLauncher() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Import CSV
      </button>
      <ImportCsvModal open={open} onOpenChange={setOpen} />
    </>
  );
}
