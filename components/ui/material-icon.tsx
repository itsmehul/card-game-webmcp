import type { MaterialSymbol } from "material-symbols";
import { cn } from "@/lib/utils";

export type MaterialIconName = MaterialSymbol;

const sizeClass = {
  xs: "text-[14px] leading-none",
  sm: "text-[18px] leading-none",
  md: "text-[22px] leading-none",
  lg: "text-[28px] leading-none",
} as const;

export interface MaterialIconProps {
  name: MaterialIconName;
  className?: string;
  size?: keyof typeof sizeClass;
  filled?: boolean;
  /** Accessible label; omit when a visible text label is already present. */
  label?: string;
}

export function MaterialIcon({
  name,
  className,
  size = "sm",
  filled = false,
  label,
}: MaterialIconProps) {
  return (
    <span
      className={cn(
        "material-symbols-outlined inline-flex shrink-0 select-none items-center justify-center",
        sizeClass[size],
        className,
      )}
      style={{
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    >
      {name}
    </span>
  );
}
