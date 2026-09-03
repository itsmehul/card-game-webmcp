"use client";

import { motion } from "framer-motion";
import { PlayingCard } from "@/components/cards/playing-card";

export function StockPile({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[8.85rem] w-[6.6rem]">
        {count > 0 ? (
          <>
            <motion.div
              key="stock-1"
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-0 top-0"
            >
              <PlayingCard id="stock-1" faceUp={false} noEnter />
            </motion.div>
            {count > 1 && (
              <motion.div
                key="stock-2"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="absolute left-0.5 top-0.5"
              >
                <PlayingCard id="stock-2" faceUp={false} noEnter />
              </motion.div>
            )}
            {count > 2 && (
              <motion.div
                key="stock-3"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="absolute left-1 top-1"
              >
                <PlayingCard id="stock-3" faceUp={false} noEnter />
              </motion.div>
            )}
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-emerald-800/60 text-[10px] text-emerald-700"
          >
            Empty
          </motion.div>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        Stock · {count}
      </span>
    </div>
  );
}
