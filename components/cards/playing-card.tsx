"use client";

import { cn } from "@/lib/utils";
import type { Rank, Suit } from "@/lib/game";

const SUIT_SYMBOL: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  none: "★",
};

const RED_SUITS = new Set<Suit>(["hearts", "diamonds"]);

export interface PlayingCardProps {
  id: string;
  faceUp: boolean;
  rank?: Rank;
  suit?: Suit;
  selected?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
  muted?: boolean;
}

export function PlayingCard({
  faceUp,
  rank,
  suit = "none",
  selected,
  onClick,
  size = "md",
  className,
  muted,
}: PlayingCardProps) {
  const isRed = faceUp && RED_SUITS.has(suit);
  const dims =
    size === "sm" ? "h-14 w-10 text-[10px]" : "h-[4.5rem] w-12 text-xs";

  if (!faceUp) {
    return (
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className={cn(
          dims,
          "relative shrink-0 rounded-md border border-emerald-900/80 bg-[linear-gradient(135deg,#14532d_0%,#052e16_50%,#14532d_100%)] shadow-sm",
          "disabled:cursor-default",
          selected && "ring-2 ring-amber-400",
          muted && "opacity-50",
          className,
        )}
        aria-label="Face-down card"
      >
        <span className="pointer-events-none absolute inset-1 rounded border border-emerald-500/20" />
      </button>
    );
  }

  const label = rank === "joker" ? "Jok" : rank;

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        dims,
        "relative shrink-0 rounded-md border bg-[#f8f5ec] shadow-sm",
        "flex flex-col items-start justify-between p-1 font-semibold leading-none",
        isRed ? "text-red-700 border-red-200" : "text-zinc-900 border-zinc-300",
        "disabled:cursor-default",
        selected && "ring-2 ring-amber-400 -translate-y-1",
        muted && "opacity-50",
        className,
      )}
      aria-label={`${label} of ${suit}`}
    >
      <span>{label}</span>
      <span className="self-center text-base">{SUIT_SYMBOL[suit]}</span>
      <span className="self-end rotate-180">{label}</span>
    </button>
  );
}
