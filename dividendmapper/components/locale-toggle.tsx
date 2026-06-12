"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/locale/context";
import { cn } from "@/lib/utils";

const OPTIONS = [
  {
    value: "uk",
    flag: "🇬🇧",
    label: "UK",
    title: "Switch to UK ISA / SIPP / State Pension",
  },
  {
    value: "us",
    flag: "🇺🇸",
    label: "US",
    title: "Switch to US 401(k) / IRA / Social Security",
  },
] as const;

const HINT_KEY = "dm_locale_hint_seen";
const HINT_TIMEOUT_MS = 8000;

function hasSeenLocaleHint(): boolean {
  try {
    return window.localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return true;
  }
}

export function LocaleToggle() {
  const { config, setLocale } = useLocale();
  const pathname = usePathname();
  const [hintDismissed, setHintDismissed] = useState(() => hasSeenLocaleHint());

  const showHint = Boolean(pathname?.startsWith("/tools/")) && !hintDismissed;

  function markHintSeen() {
    setHintDismissed(true);
    try {
      window.localStorage.setItem(HINT_KEY, "1");
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    if (!showHint) return;
    const timer = window.setTimeout(() => {
      markHintSeen();
    }, HINT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [showHint]);

  function dismissHint() {
    markHintSeen();
  }

  function handleSelect(value: "uk" | "us") {
    setLocale(value);
    if (showHint) dismissHint();
  }

  return (
    <div className="relative flex shrink-0 items-center gap-2">
      <span className="hidden text-xs font-medium uppercase tracking-wider text-muted-foreground lg:inline">
        Region
      </span>
      <div
        role="group"
        aria-label="Locale"
        className="inline-flex items-center rounded-full border border-border bg-card p-0.5 text-sm shadow-xs"
      >
        {OPTIONS.map((opt) => {
          const active = config.locale === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.title}
              onClick={() => handleSelect(opt.value)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                active
                  ? "bg-brand-600 text-white"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span aria-hidden>{opt.flag}</span>
              <span className="hidden sm:inline">{opt.label}</span>
            </button>
          );
        })}
      </div>
      {showHint && (
        <div
          role="status"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-lg border border-border bg-card p-3 text-xs text-foreground shadow-lg"
        >
          <p className="leading-snug">
            Switch between UK and US tax wrappers, currency, and rules. Defaults to UK.
          </p>
          <button
            type="button"
            onClick={dismissHint}
            className="mt-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
