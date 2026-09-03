"use client";

import { PlayingCard } from "@/components/cards/playing-card";
import type { CardPublicView } from "@/lib/game";

export function PlayArea({ cards }: { cards: CardPublicView[] }) {
  return (
    <div className="flex min-h-[9rem] min-w-[14rem] flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {cards.length === 0 ? (
          <div className="flex h-[8.85rem] min-w-[10rem] items-center justify-center rounded-lg border border-dashed border-emerald-800/50 px-4 text-xs text-emerald-700">
            Play area
          </div>
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
      </div>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        Community / Tableau
      </span>
    </div>
  );
}
