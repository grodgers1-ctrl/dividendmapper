"use client";

import * as React from "react";
import { Switch } from "@base-ui/react/switch";
import { cn } from "@/lib/utils";

interface ToggleFieldProps {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  helpText?: React.ReactNode;
  className?: string;
}

export function ToggleField({
  id,
  label,
  checked,
  onChange,
  helpText,
  className,
}: ToggleFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={id}
          className="text-sm font-medium text-foreground"
        >
          {label}
        </label>
        <Switch.Root
          id={id}
          checked={checked}
          onCheckedChange={(next) => onChange(next)}
          className={cn(
            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors",
            "data-[checked]:bg-brand-600 data-[unchecked]:bg-muted",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          )}
        >
          <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white shadow-sm transition-transform data-[checked]:translate-x-[18px]" />
        </Switch.Root>
      </div>
      {helpText && <p className="text-xs text-muted-foreground">{helpText}</p>}
    </div>
  );
}
