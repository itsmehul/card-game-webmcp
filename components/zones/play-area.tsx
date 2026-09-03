"use client";

import { AnimatePresence, motion } from "framer-motion";
import { MaterialIcon } from "@/components/ui/material-icon";
import { PlayingCard } from "@/components/cards/playing-card";
import type { CardPublicView, PlayLayout } from "@/lib/game";

export function PlayArea({
  cards,
  layout = "spread",
}: {
  cards: CardPublicView[];
  layout?: PlayLayout;
}) {
  const stackCards = cards.slice(-3);

  if (layout === "stack") {
    return (
      <div className="flex min-h-[9rem] min-w-[14rem] flex-col items-center gap-1">
        <AnimatePresence initial={false}>
          {cards.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-[8.85rem] min-w-[10rem] items-center justify-center rounded-lg border border-dashed border-emerald-800/50 px-4 text-xs text-emerald-700"
            >
              Play pile
            </motion.div>
          ) : (
            <motion.div
              key="stack"
              className="relative h-[9.75rem] w-[8.5rem]"
              aria-label={`Play pile with ${cards.length} cards`}
            >
              <AnimatePresence initial={false}>
                {stackCards.map((card, index) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: -18, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      x: "-50%",
                      rotate: (index - stackCards.length + 1) * 3,
                      translateY: index * 2,
                    }}
                    exit={{ opacity: 0, scale: 0.9, y: -12 }}
                    transition={{ type: "spring", stiffness: 240, damping: 22 }}
                    style={{
                      zIndex: index,
                      left: "50%",
                      top: 0,
                      position: "absolute",
                    }}
                  >
                    <PlayingCard
                      id={card.id}
                      faceUp={card.faceUp}
                      rank={card.rank}
                      suit={card.suit}
                      noEnter
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              <motion.span
                key={`count-${cards.length}`}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="absolute -right-2 -top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-semibold text-emerald-950"
              >
                {cards.length}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
        <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-emerald-400/80">
          <MaterialIcon name="style" size="xs" />
          Play pile
        </span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[9rem] min-w-[14rem] flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <AnimatePresence initial={false}>
          {cards.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex h-[8.85rem] min-w-[10rem] items-center justify-center rounded-lg border border-dashed border-emerald-800/50 px-4 text-xs text-emerald-700"
            >
              Play area
            </motion.div>
          ) : (
            cards.map((c) => (
              <PlayingCard
                key={c.id}
                id={c.id}
                faceUp={c.faceUp}
                rank={c.rank}
                suit={c.suit}
              />
            ))
          )}
        </AnimatePresence>
      </div>
      <span className="inline-flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-emerald-400/80">
        <MaterialIcon name="grid_view" size="xs" />
        Community / Tableau
      </span>
    </div>
  );
}
