"use client";

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
      {top ? (
        <PlayingCard
          id={top.id}
          faceUp={top.faceUp}
          rank={top.rank}
          suit={top.suit}
          size="sm"
        />
      ) : (
        <div className="flex h-14 w-10 items-center justify-center rounded-md border border-dashed border-emerald-800/60 text-[10px] text-emerald-700">
          —
        </div>
      )}
      <span className="text-[10px] uppercase tracking-wide text-emerald-400/80">
        {label} · {cards.length}
      </span>
    </div>
  );
}
