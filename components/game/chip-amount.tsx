import { MaterialIcon } from "@/components/ui/material-icon";
import { cn } from "@/lib/utils";

export function ChipAmount({
  amount,
  className,
}: {
  amount: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums text-amber-300/90",
        className,
      )}
      title={`${amount} chips`}
    >
      <MaterialIcon name="poker_chip" size="xs" filled className="text-amber-400" />
      <span>{amount}</span>
    </span>
  );
}
