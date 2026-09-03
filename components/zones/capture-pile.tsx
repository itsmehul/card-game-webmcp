"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/cards/playing-card";
import type { CardPublicView } from "@/lib/game";

export function CapturePile({
  cards,
  label = "Capture",
}: {
  cards: CardPublicView[];
  label?: string;
}) {
  const top = cards[cards.length - 1] ?? null;
  return (
    <div className="flex flex-col items-center gap-1">
      <AnimatePresence initial={false}>
        {top ? (
          <motion.div
            key={top.id}
            initial={{ opacity: 0, y: -16, scale: 0.85, rotateZ: 8 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <PlayingCard
              id={top.id}
              faceUp={top.faceUp}
              rank={top.rank}
              suit={top.suit}
              size="sm"
              noEnter
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-[5.75rem] w-[4.35rem] items-center justify-center rounded-lg border border-dashed border-emerald-800/60 text-xs text-emerald-700"
          >
            —
          </motion.div>
        )}
      </AnimatePresence>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        {label} · {cards.length}
      </span>
    </div>
  );
}
