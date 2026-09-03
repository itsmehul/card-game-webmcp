"use client";

import * as React from "react";
import {
  MaterialIcon,
  type MaterialIconName,
} from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

interface ToggleGroupProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{
    value: string;
    label: string;
    icon?: MaterialIconName;
  }>;
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
              "inline-flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50",
              active
                ? "bg-emerald-600 text-white"
                : "text-emerald-200/80 hover:text-white",
            )}
          >
            {opt.icon && (
              <MaterialIcon name={opt.icon} size="xs" filled={active} />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
