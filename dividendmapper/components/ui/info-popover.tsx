"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface InfoPopoverProps {
  /** Accessible label for the trigger button (read by screen readers). */
  label: string;
  /** Popover body — short paragraphs, no headings. */
  children: React.ReactNode;
  /** Override the trigger size. Defaults to 14×14 px. */
  className?: string;
  /** Where the popover opens relative to the trigger. */
  side?: "bottom" | "top";
  /** Horizontal alignment relative to the trigger. */
  align?: "start" | "center" | "end";
}

/**
 * Click-to-open info icon for inline jargon explanations.
 *
 * Why click rather than hover-only: hover popovers are unusable on touch
 * devices. The trigger remains keyboard-focusable; Escape closes; clicking
 * outside closes; the panel is rendered inline so it inherits the parent
 * stacking context.
 */
export function InfoPopover({
  label,
  children,
  className,
  side = "bottom",
  align = "start",
}: InfoPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-muted-foreground/40 text-[9px] font-semibold text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          className
        )}
      >
        i
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover px-4 py-3 text-xs leading-relaxed text-popover-foreground shadow-lg sm:w-80",
            side === "bottom" ? "top-[calc(100%+0.5rem)]" : "bottom-[calc(100%+0.5rem)]",
            align === "start" && "left-0",
            align === "center" && "left-1/2 -translate-x-1/2",
            align === "end" && "right-0"
          )}
          // Stop pointer events from bubbling to the document handler that
          // closes the popover on outside-click.
          onPointerDown={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      )}
    </span>
  );
}
