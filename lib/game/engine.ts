import type {
  Card,
  ChipLedger,
  CreateGameOptions,
  EnabledZones,
  GameSession,
  HumanGameView,
  LegalAction,
  Player,
  Rank,
  Suit,
  Visibility,
} from "./types";

const SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const RANKS: Rank[] = [
  "A",
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
];

const DEFAULT_ZONES: EnabledZones = {
  stock: true,
  hand: true,
  play: true,
  discard: true,
  capture: false,
};

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createDeck(includeJokers: boolean): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${rank}_${suit}`,
        rank,
        suit,
        location: { zone: "stock" },
        visibility: "unknown",
      });
    }
  }
  if (includeJokers) {
    cards.push(
      {
        id: "joker_red",
        rank: "joker",
        suit: "none",
        location: { zone: "stock" },
        visibility: "unknown",
      },
      {
        id: "joker_black",
        rank: "joker",
        suit: "none",
        location: { zone: "stock" },
        visibility: "unknown",
      },
    );
  }
  return cards;
}

/** Fisher–Yates shuffle; returns a new card array with stock locations reset. */
export function shuffle(cards: Card[]): Card[] {
  const next = cards.map((c) => ({
    ...c,
    location: { zone: "stock" as const },
    visibility: "unknown" as Visibility,
  }));
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function stockOrder(cards: Card[]): Card[] {
  return cards.filter((c) => c.location.zone === "stock");
}

function updateCards(
  cards: Card[],
  ids: string[],
  patch: Partial<Card> | ((card: Card) => Partial<Card>),
): Card[] {
  const idSet = new Set(ids);
  return cards.map((card) => {
    if (!idSet.has(card.id)) return card;
    const partial = typeof patch === "function" ? patch(card) : patch;
    return { ...card, ...partial };
  });
}

export function createSession(options: CreateGameOptions): GameSession {
  const botCount = Math.max(1, Math.min(options.botCount ?? 2, 5));
  const jokers = options.jokers ?? false;
  const mode = options.mode ?? "practice";
  const enabledZones: EnabledZones = {
    ...DEFAULT_ZONES,
    ...options.enabledZones,
  };

  const human: Player = {
    id: "human",
    name: "You",
    kind: "human",
    folded: false,
  };
  const bots: Player[] = Array.from({ length: botCount }, (_, i) => ({
    id: `bot_${i + 1}`,
    name: `Bot ${i + 1}`,
    kind: "bot" as const,
    folded: false,
  }));
  const players = [human, ...bots];

  let chips: ChipLedger | null = null;
  if (options.chips !== false) {
    const starting = options.startingStack ?? 1000;
    const stacks: Record<string, number> = {};
    const contributions: Record<string, number> = {};
    for (const p of players) {
      stacks[p.id] = starting;
      contributions[p.id] = 0;
    }
    chips = { stacks, pot: 0, currentBet: 0, contributions };
  }

  return {
    id: uid("game"),
    name: options.name,
    jokers,
    enabledZones,
    players,
    turnIndex: 0,
    turnDirection: options.turnDirection ?? "clockwise",
    mode,
    phase: options.phase ?? "waiting_to_deal",
    legalActions: options.legalActions ?? [],
    cards: shuffle(createDeck(jokers)),
    chips,
    narration: [],
    instructions: options.instructions ?? "",
    startedAt: Date.now(),
  };
}

export function deal(
  session: GameSession,
  playerId: string,
  count: number,
  visibility: Visibility = "hidden",
): GameSession {
  const player = session.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);
  if (!session.enabledZones.hand) throw new Error("Hand zone is disabled");

  const stock = stockOrder(session.cards);
  if (stock.length < count) {
    throw new Error(`Not enough cards in stock (need ${count}, have ${stock.length})`);
  }
  const taken = stock.slice(0, count).map((c) => c.id);
  return {
    ...session,
    cards: updateCards(session.cards, taken, {
      location: { zone: "hand", ownerId: playerId },
      visibility,
    }),
  };
}

export function draw(
  session: GameSession,
  playerId: string,
  count = 1,
  visibility: Visibility = "hidden",
): GameSession {
  return deal(session, playerId, count, visibility);
}

export function play(
  session: GameSession,
  playerId: string,
  cardIds: string[],
  visibility: Visibility = "public",
): GameSession {
  if (!session.enabledZones.play) throw new Error("Play zone is disabled");
  assertOwnedInHand(session, playerId, cardIds);
  return {
    ...session,
    cards: updateCards(session.cards, cardIds, {
      location: { zone: "play" },
      visibility,
    }),
  };
}

export function discard(
  session: GameSession,
  playerId: string,
  cardIds: string[],
  visibility: Visibility = "public",
): GameSession {
  if (!session.enabledZones.discard) throw new Error("Discard zone is disabled");
  assertOwnedInHand(session, playerId, cardIds);
  return {
    ...session,
    cards: updateCards(session.cards, cardIds, {
      location: { zone: "discard" },
      visibility,
    }),
  };
}

export function capture(
  session: GameSession,
  playerId: string,
  cardIds: string[],
  visibility: Visibility = "public",
): GameSession {
  if (!session.enabledZones.capture) throw new Error("Capture zone is disabled");
  const player = session.players.find((p) => p.id === playerId);
  if (!player) throw new Error(`Unknown player: ${playerId}`);

  for (const id of cardIds) {
    const card = session.cards.find((c) => c.id === id);
    if (!card) throw new Error(`Unknown card: ${id}`);
  }

  return {
    ...session,
    cards: updateCards(session.cards, cardIds, {
      location: { zone: "capture", ownerId: playerId },
      visibility,
    }),
  };
}

export function reveal(
  session: GameSession,
  cardIds: string[],
  visibility: Visibility = "public",
): GameSession {
  for (const id of cardIds) {
    const card = session.cards.find((c) => c.id === id);
    if (!card) throw new Error(`Unknown card: ${id}`);
  }
  return {
    ...session,
    cards: updateCards(session.cards, cardIds, { visibility }),
  };
}

/** Move top N stock cards into the play area (e.g. flop / community). */
export function dealToPlay(
  session: GameSession,
  count: number,
  visibility: Visibility = "public",
): GameSession {
  if (!session.enabledZones.play) throw new Error("Play zone is disabled");
  const stock = stockOrder(session.cards);
  if (stock.length < count) {
    throw new Error(`Not enough cards in stock (need ${count}, have ${stock.length})`);
  }
  const taken = stock.slice(0, count).map((c) => c.id);
  return {
    ...session,
    cards: updateCards(session.cards, taken, {
      location: { zone: "play" },
      visibility,
    }),
  };
}

export function rotateTurn(session: GameSession): GameSession {
  const n = session.players.length;
  if (n === 0) return session;
  const step = session.turnDirection === "clockwise" ? 1 : -1;
  let next = session.turnIndex;
  for (let i = 0; i < n; i++) {
    next = (next + step + n) % n;
    if (!session.players[next].folded) break;
  }
  return { ...session, turnIndex: next };
}

export function setPhase(session: GameSession, phase: string): GameSession {
  return { ...session, phase };
}

export function setLegalActions(
  session: GameSession,
  legalActions: LegalAction[],
): GameSession {
  return { ...session, legalActions };
}

/**
 * Apply an agent-defined legal action for the human seat. Effects come from
 * the action object (primitive, nextPhase, nextActions, rotateTurn, etc.).
 */
export function applyHumanLegalAction(
  session: GameSession,
  action: LegalAction,
  opts: { selectedCardId?: string | null; amount?: number } = {},
): GameSession {
  const primitive = action.primitive ?? action.chipAction;
  const count = action.count ?? 1;
  const visibility = action.visibility ?? "hidden";
  const amount = opts.amount ?? action.amount ?? 0;
  let next = session;

  if (
    (action.requiresCardSelection ||
      primitive === "play" ||
      primitive === "discard" ||
      primitive === "capture") &&
    !opts.selectedCardId
  ) {
    throw new Error(`Select a card from your hand to ${action.label}`);
  }

  switch (primitive) {
    case "deal_all": {
      for (const p of next.players) {
        if (!p.folded) {
          next = deal(next, p.id, count, visibility);
        }
      }
      break;
    }
    case "draw":
      next = draw(next, "human", count, visibility);
      break;
    case "play":
      next = play(next, "human", [opts.selectedCardId!], action.visibility ?? "public");
      break;
    case "discard":
      next = discard(
        next,
        "human",
        [opts.selectedCardId!],
        action.visibility ?? "public",
      );
      break;
    case "capture":
      next = capture(
        next,
        "human",
        [opts.selectedCardId!],
        action.visibility ?? "public",
      );
      break;
    case "fold":
    case "check":
    case "call":
    case "bet":
    case "raise":
      next = chipAction(next, "human", primitive, amount);
      break;
    case "pass":
    case undefined:
      break;
    default:
      throw new Error(`Action not available: ${action.label}`);
  }

  if (action.nextPhase !== undefined) {
    next = setPhase(next, action.nextPhase);
  }
  if (action.nextActions !== undefined) {
    next = setLegalActions(next, action.nextActions);
  }
  if (action.rotateTurn) {
    next = rotateTurn(next);
  }
  if (action.narration) {
    next = narrate(next, action.narration);
  } else if (primitive && primitive !== "pass") {
    next = narrate(next, `You chose ${action.label}.`);
  }

  return next;
}

export function setMode(
  session: GameSession,
  mode: GameSession["mode"],
): GameSession {
  return { ...session, mode };
}

export function narrate(session: GameSession, text: string): GameSession {
  const entry = { id: uid("n"), text, at: Date.now() };
  return {
    ...session,
    narration: [...session.narration.slice(-49), entry],
  };
}

export function setInstructions(
  session: GameSession,
  text: string,
): GameSession {
  return { ...session, instructions: text };
}

export function chipAction(
  session: GameSession,
  playerId: string,
  action: "fold" | "check" | "call" | "bet" | "raise",
  amount = 0,
): GameSession {
  if (!session.chips) throw new Error("Chips are disabled for this game");
  const chips = structuredClone(session.chips);
  const stack = chips.stacks[playerId];
  if (stack === undefined) throw new Error(`Unknown player chips: ${playerId}`);

  let players = session.players;

  switch (action) {
    case "fold": {
      players = players.map((p) =>
        p.id === playerId ? { ...p, folded: true } : p,
      );
      break;
    }
    case "check": {
      if (chips.currentBet > (chips.contributions[playerId] ?? 0)) {
        throw new Error("Cannot check; there is a bet to call");
      }
      break;
    }
    case "call": {
      const owed = chips.currentBet - (chips.contributions[playerId] ?? 0);
      const pay = Math.min(owed, stack);
      chips.stacks[playerId] -= pay;
      chips.contributions[playerId] = (chips.contributions[playerId] ?? 0) + pay;
      chips.pot += pay;
      break;
    }
    case "bet":
    case "raise": {
      if (amount <= 0) throw new Error(`${action} requires a positive amount`);
      const already = chips.contributions[playerId] ?? 0;
      const totalNeeded = action === "bet" ? amount : chips.currentBet + amount;
      const pay = Math.min(totalNeeded - already, stack);
      if (pay <= 0) throw new Error("Nothing to put in");
      chips.stacks[playerId] -= pay;
      chips.contributions[playerId] = already + pay;
      chips.pot += pay;
      chips.currentBet = Math.max(chips.currentBet, chips.contributions[playerId]);
      break;
    }
  }

  return { ...session, chips, players };
}

export function resetBettingRound(session: GameSession): GameSession {
  if (!session.chips) return session;
  const contributions: Record<string, number> = {};
  for (const p of session.players) contributions[p.id] = 0;
  return {
    ...session,
    chips: {
      ...session.chips,
      currentBet: 0,
      contributions,
    },
  };
}

function assertOwnedInHand(
  session: GameSession,
  playerId: string,
  cardIds: string[],
): void {
  for (const id of cardIds) {
    const card = session.cards.find((c) => c.id === id);
    if (!card) throw new Error(`Unknown card: ${id}`);
    if (card.location.zone !== "hand" || card.location.ownerId !== playerId) {
      throw new Error(`Card ${id} is not in ${playerId}'s hand`);
    }
  }
}

export function currentPlayer(session: GameSession): Player | null {
  return session.players[session.turnIndex] ?? null;
}

function canViewerSee(
  card: Card,
  viewerId: string,
  omniscient: boolean,
): boolean {
  if (omniscient) return true;
  if (card.visibility === "public") return true;
  if (card.visibility === "unknown") return false;
  // hidden
  return card.location.ownerId === viewerId;
}

export function toCardView(
  card: Card,
  viewerId: string,
  omniscient: boolean,
) {
  const faceUp = canViewerSee(card, viewerId, omniscient);
  if (!faceUp) {
    return { id: card.id, faceUp: false as const };
  }
  return {
    id: card.id,
    faceUp: true as const,
    rank: card.rank,
    suit: card.suit,
  };
}

export function getHumanView(session: GameSession): HumanGameView {
  const viewerId = "human";
  const turn = currentPlayer(session);
  const play = session.cards
    .filter((c) => c.location.zone === "play")
    .map((c) => toCardView(c, viewerId, false));
  const discardCards = session.cards.filter((c) => c.location.zone === "discard");
  const discardTop = discardCards.length
    ? toCardView(discardCards[discardCards.length - 1], viewerId, false)
    : null;

  return {
    name: session.name,
    mode: session.mode,
    phase: session.phase,
    turnPlayerId: turn?.id ?? null,
    turnPlayerName: turn?.name ?? null,
    legalActions: session.legalActions,
    players: session.players.map((p) => {
      const handCards = session.cards.filter(
        (c) => c.location.zone === "hand" && c.location.ownerId === p.id,
      );
      const captureCards = session.cards.filter(
        (c) => c.location.zone === "capture" && c.location.ownerId === p.id,
      );
      return {
        id: p.id,
        name: p.name,
        kind: p.kind,
        folded: p.folded,
        handCount: handCards.length,
        captureCount: captureCards.length,
        chips: session.chips?.stacks[p.id] ?? null,
        hand: handCards.map((c) => toCardView(c, viewerId, false)),
      };
    }),
    stockCount: session.cards.filter((c) => c.location.zone === "stock").length,
    discardTop,
    discardCount: discardCards.length,
    play,
    narration: session.narration,
    instructions: session.instructions,
    chips: session.chips,
  };
}

export function getOmniscientState(session: GameSession) {
  return {
    id: session.id,
    name: session.name,
    mode: session.mode,
    phase: session.phase,
    turnIndex: session.turnIndex,
    turnPlayerId: currentPlayer(session)?.id ?? null,
    turnDirection: session.turnDirection,
    jokers: session.jokers,
    enabledZones: session.enabledZones,
    legalActions: session.legalActions,
    players: session.players,
    chips: session.chips,
    narration: session.narration,
    instructions: session.instructions,
    cards: session.cards.map((c) => ({
      id: c.id,
      rank: c.rank,
      suit: c.suit,
      zone: c.location.zone,
      ownerId: c.location.ownerId ?? null,
      visibility: c.visibility,
    })),
    stockCount: session.cards.filter((c) => c.location.zone === "stock").length,
  };
}
