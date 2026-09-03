"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ToggleGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
}

export function ToggleGroup({
  value,
  onValueChange,
  options,
  className,
  disabled,
}: ToggleGroupProps) {
  return (
    <div
      className={cn(
        "inline-flex rounded-md border border-emerald-800 bg-emerald-950/40 p-0.5",
        className,
      )}
      role="group"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-emerald-600 text-white"
                : "text-emerald-200/80 hover:text-white",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
