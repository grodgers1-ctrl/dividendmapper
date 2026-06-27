"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

export const TOOL_LINKS = [
  { href: "/tools/retirement-calculator", label: "Retirement calculator" },
  { href: "/tools/dcf-calculator", label: "DCF calculator" },
  { href: "/scoring", label: "Resilience scoring" },
  { href: "/income-vehicles", label: "Income vehicles" },
  { href: "/dividend-calendar", label: "Dividend calendar" },
];

export function ToolsDropdown() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function onTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKey}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground hover:shadow-sm hover:shadow-brand-500/20"
      >
        Tools
        <span aria-hidden className="text-xs">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-border bg-background p-1 shadow-md"
        >
          {TOOL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
