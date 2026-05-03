"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface NumberFieldProps {
  id: string;
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  helpText?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
}

/**
 * Labeled number input with optional currency prefix or unit suffix. Stores the
 * raw text in local state so users can clear the field while typing without it
 * snapping back to the last numeric value.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  prefix,
  suffix,
  helpText,
  className,
  inputClassName,
  placeholder,
}: NumberFieldProps) {
  const [text, setText] = React.useState<string>(formatForEdit(value));
  const lastSyncedRef = React.useRef<number>(value);

  // Sync local text when the parent value changes from outside (e.g. preset
  // button) but not on every keystroke.
  React.useEffect(() => {
    if (value !== lastSyncedRef.current) {
      lastSyncedRef.current = value;
      setText(formatForEdit(value));
    }
  }, [value]);

  function commit(next: string) {
    setText(next);
    if (next.trim() === "" || next === "-") return;
    const parsed = Number(next.replace(/,/g, ""));
    if (Number.isNaN(parsed)) return;
    let clamped = parsed;
    if (typeof min === "number" && clamped < min) clamped = min;
    if (typeof max === "number" && clamped > max) clamped = max;
    lastSyncedRef.current = clamped;
    onChange(clamped);
  }

  function commitOnBlur() {
    if (text.trim() === "" || Number.isNaN(Number(text.replace(/,/g, "")))) {
      // Reset to last good value
      setText(formatForEdit(lastSyncedRef.current));
    } else {
      // Re-format
      setText(formatForEdit(lastSyncedRef.current));
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative flex items-center">
        {prefix && (
          <span
            aria-hidden
            className="pointer-events-none absolute left-3 font-mono text-sm text-muted-foreground"
          >
            {prefix}
          </span>
        )}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text}
          placeholder={placeholder}
          onChange={(e) => commit(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={commitOnBlur}
          min={min}
          max={max}
          step={step}
          className={cn(
            "h-10 w-full rounded-lg border border-input bg-background py-2 font-mono text-sm tabular-nums text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background",
            prefix ? "pl-7" : "pl-3",
            suffix ? "pr-10" : "pr-3",
            inputClassName
          )}
        />
        {suffix && (
          <span
            aria-hidden
            className="pointer-events-none absolute right-3 font-mono text-sm text-muted-foreground"
          >
            {suffix}
          </span>
        )}
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}

function formatForEdit(value: number): string {
  if (Number.isNaN(value) || !Number.isFinite(value)) return "";
  // Avoid trailing zeros from toFixed for ints
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toFixed(2)));
}
