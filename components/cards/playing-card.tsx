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

const SIZE = {
  sm: {
    box: "h-[5.75rem] w-[4.35rem]",
    rank: "text-[1.35rem]",
    pip: "text-[1.65rem]",
    corner: "text-[0.7rem]",
  },
  md: {
    box: "h-[8.85rem] w-[6.6rem]",
    rank: "text-[2.35rem]",
    pip: "text-[2.85rem]",
    corner: "text-base",
  },
} as const;

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
  const dims = SIZE[size];
  const isJoker = rank === "joker";
  const label = isJoker ? "J" : (rank ?? "");

  if (!faceUp) {
    return (
      <button
        type="button"
        disabled={!onClick}
        onClick={onClick}
        className={cn(
          dims.box,
          "relative shrink-0 rounded-lg border border-emerald-900/80 bg-[linear-gradient(135deg,#14532d_0%,#052e16_50%,#14532d_100%)] shadow-md",
          "disabled:cursor-default",
          selected && "ring-2 ring-amber-400",
          muted && "opacity-50",
          className,
        )}
        aria-label="Face-down card"
      >
        <span className="pointer-events-none absolute inset-1.5 rounded-md border border-emerald-500/25" />
        <span className="pointer-events-none absolute inset-3 rounded-sm border border-emerald-400/10" />
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={cn(
        dims.box,
        "relative shrink-0 overflow-hidden rounded-lg border bg-[#f8f5ec] shadow-md",
        "font-black leading-none tracking-tight",
        isRed ? "text-red-700 border-red-200" : "text-zinc-900 border-zinc-300",
        "disabled:cursor-default",
        selected && "ring-2 ring-amber-400 -translate-y-1",
        muted && "opacity-50",
        className,
      )}
      aria-label={`${rank === "joker" ? "Joker" : rank} of ${suit}`}
    >
      <span className="absolute left-1.5 top-1 flex flex-col items-center">
        <span className={cn(dims.rank, isJoker && "text-[1.6rem]")}>{label}</span>
        <span className={dims.corner}>{SUIT_SYMBOL[suit]}</span>
      </span>
      <span
        className={cn(
          "absolute inset-0 flex items-center justify-center",
          dims.pip,
        )}
      >
        {SUIT_SYMBOL[suit]}
      </span>
      <span className="absolute bottom-1 right-1.5 flex rotate-180 flex-col items-center">
        <span className={cn(dims.rank, isJoker && "text-[1.6rem]")}>{label}</span>
        <span className={dims.corner}>{SUIT_SYMBOL[suit]}</span>
      </span>
    </button>
  );
}
