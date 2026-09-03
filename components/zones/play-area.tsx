"use client";

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
        {cards.length === 0 ? (
          <div className="flex h-[8.85rem] min-w-[10rem] items-center justify-center rounded-lg border border-dashed border-emerald-800/50 px-4 text-xs text-emerald-700">
            Play pile
          </div>
        ) : (
          <div className="relative h-[9.75rem] w-[8.5rem]" aria-label={`Play pile with ${cards.length} cards`}>
            {stackCards.map((card, index) => (
              <div
                key={card.id}
                className="absolute left-1/2 top-0 -translate-x-1/2"
                style={{
                  transform: `translateX(-50%) rotate(${(index - stackCards.length + 1) * 3}deg) translateY(${index * 2}px)`,
                  zIndex: index,
                }}
              >
                <PlayingCard
                  id={card.id}
                  faceUp={card.faceUp}
                  rank={card.rank}
                  suit={card.suit}
                />
              </div>
            ))}
            <span className="absolute -right-2 -top-2 rounded-full bg-emerald-400 px-2 py-0.5 text-xs font-semibold text-emerald-950">
              {cards.length}
            </span>
          </div>
        )}
        <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
          Play pile
        </span>
      </div>
    );
  }

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
