import type { Card, GameSession, Rank } from "./types";
import { cardsInZone, rankOrder } from "./scoring";

export type PokerCategory =
  | "high_card"
  | "one_pair"
  | "two_pair"
  | "three_of_a_kind"
  | "straight"
  | "flush"
  | "full_house"
  | "four_of_a_kind"
  | "straight_flush";

const CATEGORY_RANK: Record<PokerCategory, number> = {
  high_card: 0,
  one_pair: 1,
  two_pair: 2,
  three_of_a_kind: 3,
  straight: 4,
  flush: 5,
  full_house: 6,
  four_of_a_kind: 7,
  straight_flush: 8,
};

export interface PokerHandRank {
  category: PokerCategory;
  /** Tie-breakers high to low (Ace = 14). */
  kickers: number[];
}

function pip(rank: Rank): number {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "joker") return 0;
  return Number(rank);
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...tail] = items;
  const withHead = combinations(tail, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(tail, k);
  return [...withHead, ...withoutHead];
}

function straightHigh(values: number[]): number | null {
  const uniq = [...new Set(values)].sort((a, b) => b - a);
  if (uniq.length < 5) return null;
  for (let i = 0; i <= uniq.length - 5; i++) {
    const slice = uniq.slice(i, i + 5);
    if (slice[0] - slice[4] === 4) return slice[0];
  }
  // Wheel: A-2-3-4-5
  if (
    uniq.includes(14) &&
    uniq.includes(5) &&
    uniq.includes(4) &&
    uniq.includes(3) &&
    uniq.includes(2)
  ) {
    return 5;
  }
  return null;
}

function rankFive(cards: Card[]): PokerHandRank {
  const values = cards.map((c) => pip(c.rank)).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0] && s !== "none");
  const sHigh = straightHigh(values);

  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  if (isFlush && sHigh !== null) {
    return { category: "straight_flush", kickers: [sHigh] };
  }
  if (groups[0]?.[1] === 4) {
    return {
      category: "four_of_a_kind",
      kickers: [groups[0][0], groups[1]?.[0] ?? 0],
    };
  }
  if (groups[0]?.[1] === 3 && groups[1]?.[1] === 2) {
    return {
      category: "full_house",
      kickers: [groups[0][0], groups[1][0]],
    };
  }
  if (isFlush) {
    return { category: "flush", kickers: values };
  }
  if (sHigh !== null) {
    return { category: "straight", kickers: [sHigh] };
  }
  if (groups[0]?.[1] === 3) {
    const kickers = [groups[0][0], ...groups.slice(1).map(([v]) => v)];
    return { category: "three_of_a_kind", kickers };
  }
  if (groups[0]?.[1] === 2 && groups[1]?.[1] === 2) {
    const high = Math.max(groups[0][0], groups[1][0]);
    const low = Math.min(groups[0][0], groups[1][0]);
    return {
      category: "two_pair",
      kickers: [high, low, groups[2]?.[0] ?? 0],
    };
  }
  if (groups[0]?.[1] === 2) {
    return {
      category: "one_pair",
      kickers: [groups[0][0], ...groups.slice(1).map(([v]) => v)],
    };
  }
  return { category: "high_card", kickers: values };
}

export function comparePokerRanks(a: PokerHandRank, b: PokerHandRank): number {
  const cat = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category];
  if (cat !== 0) return cat;
  const len = Math.max(a.kickers.length, b.kickers.length);
  for (let i = 0; i < len; i++) {
    const d = (a.kickers[i] ?? 0) - (b.kickers[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Best five-card rank from up to seven cards (Hold'em). */
export function evaluateBestHand(cards: Card[]): PokerHandRank {
  const playable = cards.filter((c) => c.rank !== "joker");
  if (playable.length < 5) {
    const values = playable
      .map((c) => pip(c.rank))
      .sort((a, b) => b - a);
    return { category: "high_card", kickers: values };
  }
  let best: PokerHandRank | null = null;
  for (const five of combinations(playable, 5)) {
    const rank = rankFive(five);
    if (!best || comparePokerRanks(rank, best) > 0) best = rank;
  }
  return best!;
}

export function evaluateHoldemSeat(
  session: GameSession,
  playerId: string,
): PokerHandRank {
  const hole = cardsInZone(session, "hand", playerId);
  const board = cardsInZone(session, "play");
  return evaluateBestHand([...hole, ...board]);
}

/** Active (non-folded) seats with the best Hold'em hand. */
export function holdemShowdownWinners(session: GameSession): string[] {
  const active = session.players.filter((p) => !p.folded);
  if (active.length === 0) return [];
  if (active.length === 1) return [active[0].id];

  let best: PokerHandRank | null = null;
  const winners: string[] = [];
  for (const p of active) {
    const rank = evaluateHoldemSeat(session, p.id);
    if (!best || comparePokerRanks(rank, best) > 0) {
      best = rank;
      winners.length = 0;
      winners.push(p.id);
    } else if (best && comparePokerRanks(rank, best) === 0) {
      winners.push(p.id);
    }
  }
  return winners;
}

/** Highest War-style card in play; empty winners means nothing to compare. */
export function warPlayWinners(session: GameSession): string[] {
  const byPlayer: Record<string, number> = {};
  for (const card of cardsInZone(session, "play")) {
    const owner = card.location.ownerId;
    if (!owner) continue;
    const order = rankOrder(card.rank);
    byPlayer[owner] = Math.max(byPlayer[owner] ?? -1, order);
  }
  let best = -1;
  for (const o of Object.values(byPlayer)) {
    if (o > best) best = o;
  }
  if (best < 0) return [];
  return Object.entries(byPlayer)
    .filter(([, o]) => o === best)
    .map(([id]) => id);
}
