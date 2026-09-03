"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/cards/playing-card";
import type { CardPublicView } from "@/lib/game";

export function Hand({
  cards,
  selectedIds = [],
  onSelect,
  interactive,
  label = "Your hand",
}: {
  cards: CardPublicView[];
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  interactive?: boolean;
  label?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        <AnimatePresence initial={false}>
          {cards.length === 0 ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-2 text-xs text-emerald-600"
            >
              No cards
            </motion.p>
          ) : (
            cards.map((c) => (
              <PlayingCard
                key={c.id}
                id={c.id}
                faceUp={c.faceUp}
                rank={c.rank}
                suit={c.suit}
                size="sm"
                selected={selectedIds.includes(c.id)}
                onClick={
                  interactive && onSelect ? () => onSelect(c.id) : undefined
                }
              />
            ))
          )}
        </AnimatePresence>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        {label}
      </span>
    </div>
  );
}
