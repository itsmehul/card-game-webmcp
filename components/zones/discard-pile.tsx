"use client";

import { AnimatePresence, motion } from "framer-motion";
import { PlayingCard } from "@/components/cards/playing-card";
import type { CardPublicView } from "@/lib/game";

export function DiscardPile({
  top,
  count,
}: {
  top: CardPublicView | null;
  count: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <AnimatePresence mode="popLayout" initial={false}>
        {top ? (
          <motion.div
            key={top.id}
            initial={{ opacity: 0, y: -20, scale: 0.85, rotateZ: -6 }}
            animate={{ opacity: 1, y: 0, scale: 1, rotateZ: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: -12 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
          >
            <PlayingCard
              id={top.id}
              faceUp={top.faceUp}
              rank={top.rank}
              suit={top.suit}
              noEnter
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex h-[8.85rem] w-[6.6rem] items-center justify-center rounded-lg border border-dashed border-emerald-800/60 text-xs text-emerald-700"
          >
            —
          </motion.div>
        )}
      </AnimatePresence>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        Discard · {count}
      </span>
    </div>
  );
}
