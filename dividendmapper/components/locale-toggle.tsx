"use client";

import { useLocale } from "@/lib/locale/context";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "uk", flag: "🇬🇧", label: "UK" },
  { value: "us", flag: "🇺🇸", label: "US" },
] as const;

export function LocaleToggle() {
  const { config, setLocale } = useLocale();
  return (
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
            onClick={() => setLocale(opt.value)}
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
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
