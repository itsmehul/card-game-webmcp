import type {
  Card,
  GameSession,
  HandScoring,
  Rank,
  ZoneKind,
} from "./types";

/** Ace-low ordering used for rank comparisons (War, high-card sweeps). */
const RANK_ORDER: Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "joker",
];

/** Comparable strength of a rank. Higher wins; jokers top the list. */
export function rankOrder(rank: Rank): number {
  return RANK_ORDER.indexOf(rank);
}

/** Default pip value: numbers face value, faces 10, ace 1, joker 0. */
export function defaultRankValue(rank: Rank): number {
  if (rank === "A") return 1;
  if (rank === "joker") return 0;
  if (rank === "J" || rank === "Q" || rank === "K") return 10;
  return Number(rank);
}

export function rankValue(rank: Rank, scoring?: HandScoring): number {
  const override = scoring?.values?.[rank];
  return override ?? defaultRankValue(rank);
}

export function cardsInZone(
  session: GameSession,
  zone: ZoneKind,
  ownerId?: string,
): Card[] {
  return session.cards.filter(
    (c) =>
      c.location.zone === zone &&
      (ownerId === undefined || c.location.ownerId === ownerId),
  );
}

export interface HandScoreResult {
  total: number;
  busted: boolean;
  /** True when an ace is still counted at its alternate (soft) value */
  soft: boolean;
  cardCount: number;
}

/**
 * Score a seat's zone with configurable rank values. Aces upgrade to
 * `aceAlt` one at a time while the total stays within `bustOver`, which
 * expresses Blackjack-style soft hands without hard-coding the game.
 */
export function scoreHand(
  session: GameSession,
  playerId: string,
  scoring: HandScoring = {},
): HandScoreResult {
  const zone = scoring.zone ?? "hand";
  const cards = cardsInZone(session, zone, playerId);

  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += rankValue(card.rank, scoring);
    if (card.rank === "A") aces += 1;
  }

  let soft = false;
  const { aceAlt, bustOver } = scoring;
  if (aceAlt !== undefined) {
    const bump = aceAlt - rankValue("A", scoring);
    for (let i = 0; i < aces; i++) {
      const upgraded = total + bump;
      if (bustOver !== undefined && upgraded > bustOver) break;
      total = upgraded;
      soft = true;
    }
  }

  return {
    total,
    busted: bustOver !== undefined && total > bustOver,
    soft,
    cardCount: cards.length,
  };
}

export interface ZoneComparison {
  /** Seat ids holding the highest-ranked card; more than one means a tie */
  winners: string[];
  best: number;
  /** Highest card contributed by each seat */
  byPlayer: Record<string, { cardId: string; rank: Rank; order: number }>;
}

/**
 * Compare cards a zone holds, grouped by the seat that put them there.
 * Cards without an ownerId are ignored, so only attributed plays count.
 */
export function compareZone(
  session: GameSession,
  zone: ZoneKind = "play",
): ZoneComparison {
  const byPlayer: ZoneComparison["byPlayer"] = {};

  for (const card of cardsInZone(session, zone)) {
    const owner = card.location.ownerId;
    if (!owner) continue;
    const order = rankOrder(card.rank);
    const current = byPlayer[owner];
    if (!current || order > current.order) {
      byPlayer[owner] = { cardId: card.id, rank: card.rank, order };
    }
  }

  let best = -1;
  for (const entry of Object.values(byPlayer)) {
    if (entry.order > best) best = entry.order;
  }
  const winners = Object.entries(byPlayer)
    .filter(([, entry]) => entry.order === best)
    .map(([id]) => id);

  return { winners: best === -1 ? [] : winners, best, byPlayer };
}

/** Group a seat's hand by rank and return the complete sets of `size`. */
export function findSets(
  session: GameSession,
  playerId: string,
  size: number,
  zone: ZoneKind = "hand",
): Array<{ rank: Rank; cardIds: string[] }> {
  if (size < 2) throw new Error("Set size must be at least 2");
  const groups = new Map<Rank, string[]>();
  for (const card of cardsInZone(session, zone, playerId)) {
    const list = groups.get(card.rank) ?? [];
    list.push(card.id);
    groups.set(card.rank, list);
  }

  const sets: Array<{ rank: Rank; cardIds: string[] }> = [];
  for (const [rank, ids] of groups) {
    for (let i = 0; i + size <= ids.length; i += size) {
      sets.push({ rank, cardIds: ids.slice(i, i + size) });
    }
  }
  return sets;
}
