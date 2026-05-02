"use client";

import * as React from "react";
import { Slider } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";

interface SliderFieldProps {
  id: string;
  label: React.ReactNode;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Right-side display value (e.g. "7.0%", "55", "£500") */
  displayValue: React.ReactNode;
  helpText?: React.ReactNode;
  className?: string;
}

/**
 * Labeled slider with a value readout. Used for percentages, ages, and
 * allocation sliders. Number-input-paired controls use `NumberField` instead.
 */
export function SliderField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  displayValue,
  helpText,
  className,
}: SliderFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <span className="font-mono text-sm font-medium tabular-nums text-foreground">
          {displayValue}
        </span>
      </div>
      <Slider.Root
        id={id}
        value={value}
        onValueChange={(v) => onChange(v as number)}
        min={min}
        max={max}
        step={step}
      >
        <Slider.Control className="flex h-5 w-full items-center">
          <Slider.Track className="relative h-1.5 w-full rounded-full bg-muted">
            <Slider.Indicator className="absolute h-full rounded-full bg-brand-500" />
            <Slider.Thumb className="block size-4 rounded-full border-2 border-brand-500 bg-background shadow-sm transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[dragging]:scale-110" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
}
