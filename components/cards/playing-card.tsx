"use client";

import { motion } from "framer-motion";
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
  },
  md: {
    box: "h-[8.85rem] w-[6.6rem]",
    rank: "text-[2.35rem]",
    pip: "text-[2.85rem]",
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
  /** Disable the deal-in entrance animation (e.g. for static piles). */
  noEnter?: boolean;
}

const spring = { type: "spring", stiffness: 260, damping: 24 } as const;

export function PlayingCard({
  faceUp,
  rank,
  suit = "none",
  selected,
  onClick,
  size = "md",
  className,
  muted,
  noEnter,
}: PlayingCardProps) {
  const isRed = faceUp && RED_SUITS.has(suit);
  const dims = SIZE[size];
  const isJoker = rank === "joker";
  const label = isJoker ? "J" : (rank ?? "");

  return (
    <motion.button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      layout
      initial={noEnter ? false : { opacity: 0, y: 14, scale: 0.86, rotateZ: -4 }}
      animate={{
        opacity: muted ? 0.5 : 1,
        y: selected ? -8 : 0,
        scale: 1,
        rotateZ: 0,
      }}
      exit={{ opacity: 0, scale: 0.86, y: -10 }}
      transition={spring}
      whileHover={onClick ? { y: -8, scale: 1.05, zIndex: 20 } : undefined}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      style={{ perspective: 1000, transformStyle: "preserve-3d" }}
      className={cn(
        dims.box,
        "relative shrink-0 rounded-lg shadow-md will-change-transform",
        "disabled:cursor-default",
        selected && "ring-2 ring-amber-400",
        className,
      )}
      aria-label={faceUp ? `${rank === "joker" ? "Joker" : rank} of ${suit}` : "Face-down card"}
    >
      {/* Back face */}
      <motion.span
        aria-hidden={faceUp}
        className="pointer-events-none absolute inset-0 rounded-lg border border-emerald-900/80 bg-[linear-gradient(135deg,#14532d_0%,#052e16_50%,#14532d_100%)] [backface-visibility:hidden]"
        animate={{ rotateY: faceUp ? 180 : 0 }}
        transition={spring}
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className="pointer-events-none absolute inset-1.5 rounded-md border border-emerald-500/25" />
        <span className="pointer-events-none absolute inset-3 rounded-sm border border-emerald-400/10" />
      </motion.span>

      {/* Front face */}
      <motion.span
        aria-hidden={!faceUp}
        className={cn(
          "pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border bg-[#f8f5ec] font-black leading-none tracking-tight [backface-visibility:hidden]",
          isRed ? "text-red-700 border-red-200" : "text-zinc-900 border-zinc-300",
        )}
        animate={{ rotateY: faceUp ? 0 : -180 }}
        transition={spring}
        style={{ transformStyle: "preserve-3d" }}
      >
        <span className={cn(dims.rank, isJoker && "text-[1.6rem]")}>{label}</span>
        <span className={dims.pip}>{SUIT_SYMBOL[suit]}</span>
      </motion.span>
    </motion.button>
  );
}
