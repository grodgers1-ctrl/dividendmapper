"use client";

import { useRouter, usePathname } from "next/navigation";

const WRAPPER_LABEL: Record<string, string> = {
  isa: "ISA",
  sipp: "SIPP",
  gia: "GIA",
  "401k": "401(k)",
  ira: "IRA",
  roth_ira: "Roth IRA",
  brokerage: "Brokerage",
};

// Fixed display order so the chip row doesn't rearrange as holdings change.
const DISPLAY_ORDER = ["isa", "sipp", "gia", "401k", "ira", "roth_ira", "brokerage"];

interface Props {
  /** Distinct wrappers actually present in the user's visible holdings. */
  present: string[];
  /** The currently active wrapper filter, or null for "All". */
  active: string | null;
}

export function WrapperFilterChips({ present, active }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  if (present.length < 2) return null;

  const ordered = DISPLAY_ORDER.filter((w) => present.includes(w));

  const setActive = (wrapper: string | null) => {
    const url = wrapper ? `${pathname}?wrapper=${wrapper}` : pathname;
    router.push(url, { scroll: false });
  };

  return (
    <div role="group" aria-label="Filter by wrapper" className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        aria-pressed={active === null}
        onClick={() => setActive(null)}
        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
          active === null
            ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-900/20 dark:text-brand-300"
            : "border-border bg-card text-muted-foreground hover:text-foreground"
        }`}
      >
        All
      </button>
      {ordered.map((w) => {
        const isActive = active === w;
        return (
          <button
            key={w}
            type="button"
            aria-pressed={isActive}
            onClick={() => setActive(w)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
              isActive
                ? "border-brand-500/40 bg-brand-50 text-brand-700 dark:border-brand-400/30 dark:bg-brand-900/20 dark:text-brand-300"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {WRAPPER_LABEL[w] ?? w}
          </button>
        );
      })}
    </div>
  );
}
