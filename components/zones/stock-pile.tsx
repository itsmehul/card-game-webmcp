"use client";

import { PlayingCard } from "@/components/cards/playing-card";

export function StockPile({ count }: { count: number }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-[4.5rem] w-12">
        {count > 0 ? (
          <>
            <PlayingCard
              id="stock-1"
              faceUp={false}
              className="absolute left-0 top-0"
            />
            {count > 1 && (
              <PlayingCard
                id="stock-2"
                faceUp={false}
                className="absolute left-0.5 top-0.5"
              />
            )}
            {count > 2 && (
              <PlayingCard
                id="stock-3"
                faceUp={false}
                className="absolute left-1 top-1"
              />
            )}
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-md border border-dashed border-emerald-800/60 text-[10px] text-emerald-700">
            Empty
          </div>
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        Stock · {count}
      </span>
    </div>
  );
}
