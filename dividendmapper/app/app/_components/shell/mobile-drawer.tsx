"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Drawer } from "./drawer";
import type { TierLike } from "./nav-items";

// Hamburger + slide-in drawer for the <md viewport. The trigger is `md:hidden`
// so the persistent desktop sidebar takes over at larger widths. Native
// `<dialog>` semantics come from @base-ui/react/dialog: backdrop click, Esc,
// and focus trap are all handled by the primitive.
//
// Closes when a nav link is clicked (onNavigate callback threaded through
// the Drawer). Backdrop tap and Escape close via the Dialog primitive.
export function MobileDrawer({
  email,
  tier,
  isAdmin,
}: {
  email: string;
  tier: TierLike;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open navigation"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[var(--canvas)]/60 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Popup
          aria-label="Application navigation"
          className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col bg-[var(--surface)] shadow-2xl transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full motion-reduce:transition-none"
        >
          <Drawer
            email={email}
            tier={tier}
            isAdmin={isAdmin}
            desktop={false}
            onNavigate={() => setOpen(false)}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
