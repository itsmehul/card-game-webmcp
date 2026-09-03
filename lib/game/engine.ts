import { compareZone, findSets, scoreHand } from "./scoring";
import type {
  Card,
  ChipLedger,
  Condition,
  CreateGameOptions,
  DealSpec,
  EnabledZones,
  GameSession,
  HumanGameView,
  LegalAction,
  Player,
  Pot,
  Rank,
  SeatTarget,
  Suit,
  SweepSpec,
  TransferSpec,
  Visibility,
  ZoneKind,
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
    const committed: Record<string, number> = {};
    for (const p of players) {
      stacks[p.id] = starting;
      contributions[p.id] = 0;
      committed[p.id] = 0;
    }
    chips = { stacks, pot: 0, currentBet: 0, contributions, committed };
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
      // ownerId is retained so the play area can be compared per seat
      location: { zone: "play", ownerId: playerId },
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

/** Give the turn to a specific seat by id. */
export function setTurn(session: GameSession, playerId: string): GameSession {
  const index = session.players.findIndex((p) => p.id === playerId);
  if (index === -1) throw new Error(`Unknown player: ${playerId}`);
  return { ...session, turnIndex: index };
}

/**
 * Move the turn using a symbolic target, so games can hand play to the
 * dealer, keep the same seat for an extra turn, or step backwards.
 */
export function moveTurn(
  session: GameSession,
  target: SeatTarget | "next" | "previous" | "same" | "first",
): GameSession {
  switch (target) {
    case "same":
    case "current":
      return session;
    case "next":
      return rotateTurn(session);
    case "first":
      return { ...session, turnIndex: 0 };
    case "previous": {
      const reversed: GameSession = {
        ...session,
        turnDirection:
          session.turnDirection === "clockwise"
            ? "counterclockwise"
            : "clockwise",
      };
      return { ...rotateTurn(reversed), turnDirection: session.turnDirection };
    }
    default:
      return setTurn(session, target);
  }
}

/** Seats a symbolic target expands to, skipping folded players. */
export function resolveSeats(
  session: GameSession,
  target: SeatTarget,
): string[] {
  const active = session.players.filter((p) => !p.folded);
  const current = currentPlayer(session);
  switch (target) {
    case "each":
      return active.map((p) => p.id);
    case "others":
      return active.filter((p) => p.id !== current?.id).map((p) => p.id);
    case "current":
      return current ? [current.id] : [];
    case "winner":
      return compareZone(session, "play").winners;
    default:
      return [target];
  }
}

function resolveSeat(session: GameSession, target: SeatTarget): string {
  const seats = resolveSeats(session, target);
  if (seats.length === 0) throw new Error(`No seat matches "${target}"`);
  return seats[0];
}

/** Display name for error messages so students see "Bot 2", not "bot_2". */
function seatName(session: GameSession, playerId: string): string {
  return session.players.find((p) => p.id === playerId)?.name ?? playerId;
}

/**
 * Deal several lines at once so seats can receive different counts and
 * visibilities in one step (e.g. a dealer up-card next to hole cards).
 */
export function dealBatch(
  session: GameSession,
  specs: DealSpec[],
): GameSession {
  let next = session;
  for (const spec of specs) {
    const visibility = spec.visibility ?? "hidden";
    if (spec.target === "play") {
      next = dealToPlay(next, spec.count, spec.visibility ?? "public");
      continue;
    }
    for (const seat of resolveSeats(next, spec.target)) {
      next = deal(next, seat, spec.count, visibility);
    }
  }
  return next;
}

/**
 * Move cards from one seat to another. Selecting by rank covers the
 * Go Fish "ask", while cardIds/count cover stealing and passing.
 */
export function transfer(
  session: GameSession,
  spec: TransferSpec,
): GameSession {
  const fromId = resolveSeat(session, spec.from);
  const toId = resolveSeat(session, spec.to);
  if (fromId === toId) throw new Error("Cannot transfer to the same seat");

  const fromZone: ZoneKind = spec.fromZone ?? "hand";
  const toZone: ZoneKind = spec.toZone ?? "hand";
  if (!session.enabledZones[toZone]) {
    throw new Error(`${toZone} zone is disabled`);
  }

  const source = session.cards.filter(
    (c) => c.location.zone === fromZone && c.location.ownerId === fromId,
  );

  let picked: string[];
  if (spec.cardIds?.length) {
    const owned = new Set(source.map((c) => c.id));
    for (const id of spec.cardIds) {
      if (!owned.has(id)) {
          throw new Error(
          `Card ${id} is not in ${seatName(session, fromId)}'s ${fromZone}`,
        );
      }
    }
    picked = spec.cardIds;
  } else if (spec.rank) {
    picked = source.filter((c) => c.rank === spec.rank).map((c) => c.id);
  } else {
    picked = source.slice(0, spec.count ?? 1).map((c) => c.id);
  }

  if (picked.length === 0) {
    if (spec.allowEmpty) return session;
    throw new Error(
      spec.rank
        ? `${seatName(session, fromId)} has no ${spec.rank}s — go fish`
        : `${seatName(session, fromId)} has no cards to give`,
    );
  }

  return {
    ...session,
    cards: updateCards(session.cards, picked, {
      location: { zone: toZone, ownerId: toId },
      visibility: spec.visibility ?? "hidden",
    }),
  };
}

/** Every active seat plays cards from hand at once (simultaneous flips). */
export function playAll(
  session: GameSession,
  count = 1,
  visibility: Visibility = "public",
): GameSession {
  if (!session.enabledZones.play) throw new Error("Play zone is disabled");
  let next = session;
  for (const player of session.players) {
    if (player.folded) continue;
    const hand = next.cards.filter(
      (c) => c.location.zone === "hand" && c.location.ownerId === player.id,
    );
    const ids = hand.slice(0, count).map((c) => c.id);
    if (ids.length === 0) continue;
    next = play(next, player.id, ids, visibility);
  }
  return next;
}

/** Award every card in a zone to one seat (trick / battle resolution). */
export function sweepZone(
  session: GameSession,
  spec: SweepSpec,
): GameSession {
  const fromZone: ZoneKind = spec.fromZone ?? "play";
  const toZone: ZoneKind = spec.toZone ?? "capture";
  if (!session.enabledZones[toZone]) {
    throw new Error(`${toZone} zone is disabled`);
  }

  const seats = resolveSeats(session, spec.to);
  if (seats.length === 0) {
    throw new Error(
      spec.to === "winner"
        ? "No winner to sweep to — the zone is empty or tied"
        : `No seat matches "${spec.to}"`,
    );
  }
  if (spec.to === "winner" && seats.length > 1) {
    const names = seats.map((id) => seatName(session, id)).join(" and ");
    throw new Error(`Tie between ${names} — resolve it first`);
  }

  const ids = session.cards
    .filter((c) => c.location.zone === fromZone)
    .map((c) => c.id);
  if (ids.length === 0) return session;

  return {
    ...session,
    cards: updateCards(session.cards, ids, {
      location: { zone: toZone, ownerId: seats[0] },
      visibility: spec.visibility ?? "public",
    }),
  };
}

/**
 * Move complete same-rank sets out of a seat's hand (pairs, books of four).
 * Returns the session unchanged when no full set exists.
 */
export function collectSets(
  session: GameSession,
  playerId: string,
  size = 4,
  toZone: ZoneKind = "capture",
): { session: GameSession; sets: Array<{ rank: Rank; cardIds: string[] }> } {
  if (!session.enabledZones[toZone]) {
    throw new Error(`${toZone} zone is disabled`);
  }
  const sets = findSets(session, playerId, size);
  if (sets.length === 0) return { session, sets };

  const ids = sets.flatMap((s) => s.cardIds);
  return {
    session: {
      ...session,
      cards: updateCards(session.cards, ids, {
        location: { zone: toZone, ownerId: playerId },
        visibility: "public",
      }),
    },
    sets,
  };
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

function compareWith(op: Condition["op"], left: number, right: number): boolean {
  switch (op ?? "gte") {
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return left > right;
    case "gte":
    default:
      return left >= right;
  }
}

/**
 * Evaluate a branch predicate against live state. This is what lets a
 * control re-arm itself (bust checks, empty-hand checks) without the UI
 * knowing any particular game's rules.
 */
export function evaluateCondition(
  session: GameSession,
  condition: Condition,
  defaultPlayerId = "human",
): boolean {
  if (condition.subject === "always") return true;

  const seats = resolveSeats(session, condition.playerId ?? defaultPlayerId);
  const playerId = seats[0] ?? defaultPlayerId;
  const value = condition.value ?? 0;

  switch (condition.subject) {
    case "hand_busted":
      return scoreHand(session, playerId, condition.scoring).busted;
    case "hand_score":
      return compareWith(
        condition.op,
        scoreHand(session, playerId, condition.scoring).total,
        value,
      );
    case "hand_count":
      return compareWith(
        condition.op,
        session.cards.filter(
          (c) => c.location.zone === "hand" && c.location.ownerId === playerId,
        ).length,
        value,
      );
    case "capture_count":
      return compareWith(
        condition.op,
        session.cards.filter(
          (c) =>
            c.location.zone === "capture" && c.location.ownerId === playerId,
        ).length,
        value,
      );
    case "stock_count":
      return compareWith(
        condition.op,
        session.cards.filter((c) => c.location.zone === "stock").length,
        value,
      );
    case "zone_count":
      return compareWith(
        condition.op,
        session.cards.filter((c) => c.location.zone === (condition.zone ?? "play"))
          .length,
        value,
      );
    case "chips":
      return compareWith(
        condition.op,
        session.chips?.stacks[playerId] ?? 0,
        value,
      );
    default:
      return false;
  }
}

/**
 * Apply an agent-defined legal action for the human seat. Effects come from
 * the action object (primitive, specs, branches, nextPhase, turn target).
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
  let autoNarration: string | null = null;

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
    case "deal_spec": {
      if (!action.dealSpec?.length) {
        throw new Error(`${action.label} needs a dealSpec`);
      }
      next = dealBatch(next, action.dealSpec);
      break;
    }
    case "draw":
      next = draw(next, "human", count, visibility);
      break;
    case "play":
      next = play(next, "human", [opts.selectedCardId!], action.visibility ?? "public");
      break;
    case "play_all":
      next = playAll(next, count, action.visibility ?? "public");
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
    case "transfer": {
      if (!action.transfer) {
        throw new Error(`${action.label} needs a transfer spec`);
      }
      const spec = action.transfer;
      // Asking by the selected card's rank is the Go Fish "do you have any…".
      const askedRank = spec.rankFromSelection
        ? next.cards.find((c) => c.id === opts.selectedCardId)?.rank
        : undefined;
      if (spec.rankFromSelection && !askedRank) {
        throw new Error(`Select a card from your hand to ${action.label}`);
      }
      next = transfer(next, {
        ...spec,
        rank: askedRank ?? spec.rank,
        cardIds:
          spec.cardIds ??
          (!spec.rankFromSelection &&
          action.requiresCardSelection &&
          opts.selectedCardId
            ? [opts.selectedCardId]
            : undefined),
      });
      break;
    }
    case "sweep": {
      if (!action.sweep) throw new Error(`${action.label} needs a sweep spec`);
      next = sweepZone(next, action.sweep);
      break;
    }
    case "collect_sets": {
      const result = collectSets(next, "human", action.setSize ?? 4);
      next = result.session;
      autoNarration = result.sets.length
        ? `You completed ${result.sets.length} set(s): ${result.sets
            .map((s) => s.rank)
            .join(", ")}.`
        : "No complete sets yet.";
      break;
    }
    case "all_in":
      next = allIn(next, "human");
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

  // Branches win over the static follow-ups so a control can re-arm itself.
  const branch = action.branches?.find((b) =>
    evaluateCondition(next, b.when, "human"),
  );

  const nextPhase = branch?.nextPhase ?? action.nextPhase;
  const nextActions = branch?.nextActions ?? action.nextActions;
  const turnTarget = branch?.turnTarget ?? action.turnTarget;
  const shouldRotate = branch?.rotateTurn ?? action.rotateTurn;

  if (nextPhase !== undefined) next = setPhase(next, nextPhase);
  if (nextActions !== undefined) next = setLegalActions(next, nextActions);
  if (turnTarget !== undefined) {
    next = moveTurn(next, turnTarget);
  } else if (shouldRotate) {
    next = rotateTurn(next);
  }

  const narration = branch?.narration ?? action.narration ?? autoNarration;
  if (narration) {
    next = narrate(next, narration);
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

/** Move chips from a stack into the pot, tracking round and hand totals. */
function commit(chips: ChipLedger, playerId: string, pay: number): void {
  chips.stacks[playerId] -= pay;
  chips.contributions[playerId] = (chips.contributions[playerId] ?? 0) + pay;
  chips.committed[playerId] = (chips.committed[playerId] ?? 0) + pay;
  chips.pot += pay;
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
      commit(chips, playerId, Math.min(owed, stack));
      break;
    }
    case "bet":
    case "raise": {
      if (amount <= 0) throw new Error(`${action} requires a positive amount`);
      const already = chips.contributions[playerId] ?? 0;
      const totalNeeded = action === "bet" ? amount : chips.currentBet + amount;
      const pay = Math.min(totalNeeded - already, stack);
      if (pay <= 0) throw new Error("Nothing to put in");
      commit(chips, playerId, pay);
      chips.currentBet = Math.max(chips.currentBet, chips.contributions[playerId]);
      break;
    }
  }

  return { ...session, chips, players };
}

/** Push a seat's whole remaining stack into the pot. */
export function allIn(session: GameSession, playerId: string): GameSession {
  if (!session.chips) throw new Error("Chips are disabled for this game");
  const chips = structuredClone(session.chips);
  const stack = chips.stacks[playerId];
  if (stack === undefined) throw new Error(`Unknown player chips: ${playerId}`);
  if (stack <= 0) throw new Error(`${playerId} has no chips left`);

  commit(chips, playerId, stack);
  chips.currentBet = Math.max(chips.currentBet, chips.contributions[playerId]);
  return { ...session, chips };
}

/** True once a seat has committed chips but has nothing left to bet. */
export function isAllIn(session: GameSession, playerId: string): boolean {
  const chips = session.chips;
  if (!chips) return false;
  return (
    (chips.stacks[playerId] ?? 0) === 0 && (chips.committed[playerId] ?? 0) > 0
  );
}

/** Post forced bets before the deal. Caps at each seat's stack. */
export function postBlinds(
  session: GameSession,
  blinds: Array<{ playerId: string; amount: number }>,
): GameSession {
  if (!session.chips) throw new Error("Chips are disabled for this game");
  const chips = structuredClone(session.chips);

  for (const blind of blinds) {
    const stack = chips.stacks[blind.playerId];
    if (stack === undefined) {
      throw new Error(`Unknown player chips: ${blind.playerId}`);
    }
    if (blind.amount <= 0) throw new Error("Blind must be positive");
    commit(chips, blind.playerId, Math.min(blind.amount, stack));
    chips.currentBet = Math.max(
      chips.currentBet,
      chips.contributions[blind.playerId],
    );
  }

  return { ...session, chips };
}

/**
 * Split the pot into main and side pots by how much each seat committed.
 * Folded seats forfeit their chips but still fund the layers they paid into.
 */
export function computePots(session: GameSession): Pot[] {
  const chips = session.chips;
  if (!chips) return [];

  const committed = session.players
    .map((p) => ({ id: p.id, folded: p.folded, amount: chips.committed[p.id] ?? 0 }))
    .filter((entry) => entry.amount > 0);
  if (committed.length === 0) return [];

  const tiers = [...new Set(committed.map((c) => c.amount))].sort((a, b) => a - b);
  const pots: Pot[] = [];
  let previous = 0;

  for (const tier of tiers) {
    const layer = tier - previous;
    const contributors = committed.filter((c) => c.amount >= tier);
    const amount = layer * contributors.length;
    const eligible = contributors.filter((c) => !c.folded).map((c) => c.id);
    if (amount > 0) pots.push({ amount, eligible });
    previous = tier;
  }

  return pots;
}

/** Pay a pot amount to winners, splitting evenly with odd chips to the first. */
export function awardPot(
  session: GameSession,
  winnerIds: string[],
  amount?: number,
): GameSession {
  if (!session.chips) throw new Error("Chips are disabled for this game");
  if (winnerIds.length === 0) throw new Error("Need at least one winner");

  const chips = structuredClone(session.chips);
  for (const id of winnerIds) {
    if (chips.stacks[id] === undefined) {
      throw new Error(`Unknown player chips: ${id}`);
    }
  }

  const payout = amount ?? chips.pot;
  if (payout > chips.pot) {
    throw new Error(`Pot only holds ${chips.pot}`);
  }

  const share = Math.floor(payout / winnerIds.length);
  const remainder = payout - share * winnerIds.length;
  winnerIds.forEach((id, i) => {
    chips.stacks[id] += share + (i === 0 ? remainder : 0);
  });
  chips.pot -= payout;

  return { ...session, chips };
}

/** Adjust a stack directly (Blackjack wager settlement, bonuses). */
export function awardChips(
  session: GameSession,
  playerId: string,
  amount: number,
): GameSession {
  if (!session.chips) throw new Error("Chips are disabled for this game");
  const chips = structuredClone(session.chips);
  if (chips.stacks[playerId] === undefined) {
    throw new Error(`Unknown player chips: ${playerId}`);
  }
  chips.stacks[playerId] = Math.max(0, chips.stacks[playerId] + amount);
  return { ...session, chips };
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

/** Clear per-hand chip bookkeeping and unfold every seat. */
export function resetHand(session: GameSession): GameSession {
  const players = session.players.map((p) => ({ ...p, folded: false }));
  if (!session.chips) return { ...session, players };

  const contributions: Record<string, number> = {};
  const committed: Record<string, number> = {};
  for (const p of session.players) {
    contributions[p.id] = 0;
    committed[p.id] = 0;
  }
  return {
    ...session,
    players,
    chips: { ...session.chips, currentBet: 0, contributions, committed },
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
    players: session.players.map((p) => ({
      ...p,
      allIn: isAllIn(session, p.id),
    })),
    chips: session.chips,
    pots: computePots(session),
    playAreaByPlayer: compareZone(session, "play").byPlayer,
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
