"use client";

import { PlayingCard } from "@/components/cards/playing-card";
import type { CardPublicView } from "@/lib/game";

export function Hand({
  cards,
  selectedId,
  onSelect,
  interactive,
  label = "Your hand",
}: {
  cards: CardPublicView[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  interactive?: boolean;
  label?: string;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex flex-wrap items-end justify-center gap-1.5">
        {cards.length === 0 ? (
          <p className="text-xs text-emerald-600">No cards</p>
        ) : (
          cards.map((c) => (
            <PlayingCard
              key={c.id}
              id={c.id}
              faceUp={c.faceUp}
              rank={c.rank}
              suit={c.suit}
              size="sm"
              selected={selectedId === c.id}
              onClick={
                interactive && onSelect ? () => onSelect(c.id) : undefined
              }
            />
          ))
        )}
      </div>
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        {label}
      </span>
    </div>
  );
}
