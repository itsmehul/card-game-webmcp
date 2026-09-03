import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import {
  MaterialIcon,
  type MaterialIconName,
} from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-emerald-600 text-white",
        secondary:
          "border-emerald-800 bg-emerald-950/70 text-emerald-100",
        outline: "border-emerald-700/70 text-emerald-100",
        muted: "border-transparent bg-zinc-800 text-zinc-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  icon?: MaterialIconName;
  iconFilled?: boolean;
}

export function Badge({
  className,
  variant,
  icon,
  iconFilled,
  children,
  ...props
}: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {icon && (
        <MaterialIcon name={icon} size="xs" filled={iconFilled} />
      )}
      {children}
    </div>
  );
}
