"use client";

import { useState } from "react";
import { EditHoldingModal, type EditHoldingModalProps } from "./EditHoldingModal";

// Opens EditHoldingModal — separated so HoldingHeader (a server component)
// can render us as a leaf client island without lifting modal state up.

export function EditHoldingButton(props: Omit<EditHoldingModalProps, "open" | "onOpenChange">) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
      >
        Edit
      </button>
      <EditHoldingModal {...props} open={open} onOpenChange={setOpen} />
    </>
  );
}
