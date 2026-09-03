import { assign } from "xstate";
import {
  allIn,
  awardChips,
  awardPot,
  capture,
  chipAction,
  collectSets,
  createDeck,
  deal,
  dealBatch,
  dealToPlay,
  discard,
  draw,
  evaluateCondition,
  narrate,
  play,
  playAll,
  postBlinds,
  resetBettingRound,
  resetHand,
  reveal,
  rotateTurn,
  setTurn,
  shuffle,
  sweepZone,
  transfer,
} from "../engine";
import { holdemShowdownWinners, warPlayWinners } from "../poker";
import { cardsInZone, findSets, scoreHand } from "../scoring";
import type {
  DealSpec,
  GameSession,
  HandScoring,
  Rank,
  TransferSpec,
  Visibility,
} from "../types";
import type { GameMachineContext, GameMachineEvent } from "./types";

type Ctx = GameMachineContext;
type Ev = GameMachineEvent;

function withSession(
  fn: (session: GameSession, event: Ev, params: Record<string, unknown>) => GameSession,
) {
  return assign(({ context, event }: { context: Ctx; event: Ev }, params: Record<string, unknown>) => ({
    session: fn(context.session, event, params ?? {}),
  }));
}

function eventAmount(event: Ev, params: Record<string, unknown>): number {
  if (typeof event.amount === "number") return event.amount;
  if (typeof params.amount === "number") return params.amount;
  return 0;
}

const BJ_SCORING: HandScoring = { aceAlt: 11, bustOver: 21 };

function mostCommonRank(session: GameSession, playerId: string): Rank | null {
  const counts = new Map<Rank, number>();
  for (const card of cardsInZone(session, "hand", playerId)) {
    counts.set(card.rank, (counts.get(card.rank) ?? 0) + 1);
  }
  let best: Rank | null = null;
  let bestCount = 0;
  for (const [rank, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount &&
        best !== null &&
        String(rank) < String(best))
    ) {
      best = rank;
      bestCount = count;
    }
  }
  return best;
}

function discardTop(session: GameSession) {
  const pile = cardsInZone(session, "discard");
  return pile.length ? pile[pile.length - 1] : null;
}

function isLegalCrazyEight(session: GameSession, cardId: string): boolean {
  const card = session.cards.find((c) => c.id === cardId);
  if (!card || card.location.zone !== "hand") return false;
  if (card.rank === "8") return true;
  const top = discardTop(session);
  if (!top) return true;
  return card.rank === top.rank || card.suit === top.suit;
}

function firstLegalCrazyEight(
  session: GameSession,
  playerId: string,
): string | null {
  for (const card of cardsInZone(session, "hand", playerId)) {
    if (isLegalCrazyEight(session, card.id)) return card.id;
  }
  return null;
}

/** Shared XState action implementations referenced by preset JSON. */
export const gameActions = {
  narrate: withSession((session, _e, params) =>
    narrate(session, String(params.text ?? "")),
  ),

  dealSpec: withSession((session, _e, params) => {
    const spec = params.dealSpec as DealSpec[] | undefined;
    if (!spec?.length) throw new Error("dealSpec action needs dealSpec params");
    return dealBatch(session, spec);
  }),

  dealAll: withSession((session, _e, params) => {
    const visibility = (params.visibility as Visibility) ?? "hidden";
    let next = session;
    if (params.all) {
      // Round-robin until the stock is empty
      let guard = 0;
      while (cardsInZone(next, "stock").length > 0 && guard++ < 200) {
        for (const p of next.players) {
          if (cardsInZone(next, "stock").length === 0) break;
          if (!p.folded) next = deal(next, p.id, 1, visibility);
        }
      }
      return next;
    }
    const count = Number(params.count ?? 1);
    for (const p of next.players) {
      if (!p.folded) next = deal(next, p.id, count, visibility);
    }
    return next;
  }),

  dealToPlay: withSession((session, _e, params) =>
    dealToPlay(
      session,
      Number(params.count ?? 1),
      (params.visibility as Visibility) ?? "public",
    ),
  ),

  drawHuman: withSession((session, _e, params) =>
    draw(
      session,
      "human",
      Number(params.count ?? 1),
      (params.visibility as Visibility) ?? "public",
    ),
  ),

  drawSeat: withSession((session, _e, params) =>
    draw(
      session,
      String(params.playerId ?? "human"),
      Number(params.count ?? 1),
      (params.visibility as Visibility) ?? "hidden",
    ),
  ),

  playHuman: withSession((session, event, params) => {
    const ids = event.selectedCardIds ?? [];
    if (!ids.length) throw new Error("Select a card to play");
    return play(
      session,
      "human",
      ids,
      (params.visibility as Visibility) ?? "public",
    );
  }),

  discardHuman: withSession((session, event, params) => {
    const ids = event.selectedCardIds ?? [];
    if (!ids.length) throw new Error("Select a card to discard");
    const cardId = ids[0];
    if (params.requireCrazyEightMatch && !isLegalCrazyEight(session, cardId)) {
      throw new Error("Card must match suit or rank (or be an 8)");
    }
    return discard(
      session,
      "human",
      ids,
      (params.visibility as Visibility) ?? "public",
    );
  }),

  captureHuman: withSession((session, event, params) => {
    const ids = event.selectedCardIds ?? [];
    if (!ids.length) throw new Error("Select a card to capture");
    return capture(
      session,
      "human",
      ids,
      (params.visibility as Visibility) ?? "public",
    );
  }),

  playAll: withSession((session, _e, params) =>
    playAll(
      session,
      Number(params.count ?? 1),
      (params.visibility as Visibility) ?? "public",
    ),
  ),

  transferAsk: withSession((session, event, params) => {
    const from = String(params.from ?? "bot_1");
    const to = String(params.to ?? "human");
    const selected = event.selectedCardIds?.[0];
    const selectedCard = selected
      ? session.cards.find((c) => c.id === selected)
      : undefined;
    const rank =
      (params.rank as Rank | undefined) ??
      (params.rankFromSelection ? selectedCard?.rank : undefined);
    if (!rank) throw new Error("Select a card whose rank you want to ask for");
    const spec: TransferSpec = {
      from,
      to,
      fromZone: "hand",
      toZone: "hand",
      rank,
      visibility: (params.visibility as Visibility) ?? "hidden",
      allowEmpty: Boolean(params.allowEmpty),
    };
    return transfer(session, spec);
  }),

  sweepPlayToWinner: withSession((session) =>
    sweepZone(session, {
      fromZone: "play",
      to: "winner",
      toZone: "capture",
    }),
  ),

  collectBooksHuman: withSession((session, _e, params) => {
    const result = collectSets(session, "human", Number(params.size ?? 4));
    return result.sets.length
      ? narrate(
          result.session,
          `You banked ${result.sets.length} book(s): ${result.sets
            .map((s) => s.rank)
            .join(", ")}.`,
        )
      : narrate(result.session, "No complete books yet.");
  }),

  collectBooksSeat: withSession((session, _e, params) => {
    const playerId = String(params.playerId ?? "human");
    const result = collectSets(session, playerId, Number(params.size ?? 4));
    return result.session;
  }),

  chipBet: withSession((session, event, params) =>
    chipAction(session, "human", "bet", eventAmount(event, params)),
  ),
  chipCall: withSession((session) => chipAction(session, "human", "call")),
  chipCheck: withSession((session) => chipAction(session, "human", "check")),
  chipRaise: withSession((session, event, params) =>
    chipAction(session, "human", "raise", eventAmount(event, params)),
  ),
  chipFold: withSession((session) => chipAction(session, "human", "fold")),
  chipAllIn: withSession((session) => allIn(session, "human")),

  postBlindsDefault: withSession((session, _e, params) => {
    const small = Number(params.small ?? 10);
    const big = Number(params.big ?? 20);
    const bots = session.players.filter((p) => p.kind === "bot");
    const sb = bots[0]?.id ?? "bot_1";
    const bb = bots[1]?.id ?? bots[0]?.id ?? "bot_1";
    return postBlinds(session, [
      { playerId: sb, amount: small },
      { playerId: bb, amount: big },
    ]);
  }),

  resetBetting: withSession((session) => resetBettingRound(session)),
  resetHand: withSession((session) => {
    let next = resetHand(session);
    // Return all cards to a fresh shuffled stock
    next = {
      ...next,
      cards: shuffle(createDeck(next.jokers)),
    };
    return next;
  }),

  rotateTurn: withSession((session) => rotateTurn(session)),
  setTurn: withSession((session, _e, params) =>
    setTurn(session, String(params.playerId ?? "human")),
  ),

  revealDealerHole: withSession((session) => {
    const dealer = session.players.find((p) => p.kind === "bot")?.id ?? "bot_1";
    const hole = cardsInZone(session, "hand", dealer).filter(
      (c) => c.visibility === "unknown" || c.visibility === "hidden",
    );
    if (!hole.length) return session;
    return reveal(
      session,
      hole.map((c) => c.id),
      "public",
    );
  }),

  dealerHitTo17: withSession((session) => {
    const dealer = session.players.find((p) => p.kind === "bot")?.id ?? "bot_1";
    let next = session;
    for (let i = 0; i < 12; i++) {
      const score = scoreHand(next, dealer, BJ_SCORING);
      if (score.total >= 17) break;
      next = draw(next, dealer, 1, "public");
    }
    return next;
  }),

  settleBlackjack: withSession((session, _e, params) => {
    const reason = String(params.reason ?? "compare");
    const dealer = session.players.find((p) => p.kind === "bot")?.id ?? "bot_1";
    const pot = session.chips?.pot ?? 0;
    const bet = pot; // single bet in pot

    if (reason === "bust") {
      let next = awardPot(session, [dealer]);
      return narrate(next, "You busted. Dealer takes the pot.");
    }

    const player = scoreHand(session, "human", BJ_SCORING);
    const dealerScore = scoreHand(session, dealer, BJ_SCORING);
    const natural =
      player.cardCount === 2 && player.total === 21 && reason !== "bust";

    if (dealerScore.busted || player.total > dealerScore.total) {
      let next = awardPot(session, ["human"]);
      const profit = natural ? Math.floor(bet * 1.5) : bet;
      next = awardChips(next, "human", profit);
      return narrate(
        next,
        natural
          ? `Blackjack! You win ${bet + profit}.`
          : `You win. Even money +${profit}.`,
      );
    }
    if (player.total === dealerScore.total) {
      const next = awardPot(session, ["human"]);
      return narrate(next, "Push — your bet returns.");
    }
    const next = awardPot(session, [dealer]);
    return narrate(next, "Dealer wins.");
  }),

  resolveWarIfDecisive: withSession((session) => {
    const winners = warPlayWinners(session);
    if (winners.length !== 1) return session;
    return sweepZone(session, {
      fromZone: "play",
      to: "winner",
      toZone: "capture",
    });
  }),

  /** After human acts in Hold'em: bots check or call, never raise. */
  holdemBotsAct: withSession((session) => {
    if (!session.chips) return session;
    let next = session;
    for (const p of next.players) {
      if (p.kind !== "bot" || p.folded) continue;
      const owed =
        next.chips!.currentBet - (next.chips!.contributions[p.id] ?? 0);
      if (owed <= 0) {
        try {
          next = chipAction(next, p.id, "check");
        } catch {
          /* already matching */
        }
      } else {
        next = chipAction(next, p.id, "call");
      }
    }
    return next;
  }),

  holdemShowdown: withSession((session) => {
    const winners = holdemShowdownWinners(session);
    if (!winners.length) return narrate(session, "No winners.");
    let next = awardPot(session, winners);
    const names = winners
      .map((id) => next.players.find((p) => p.id === id)?.name ?? id)
      .join(", ");
    return narrate(next, `Showdown — ${names} win(s) the pot.`);
  }),

  awardToFoldWinner: withSession((session) => {
    const active = session.players.filter((p) => !p.folded);
    if (active.length !== 1) return session;
    let next = awardPot(session, [active[0].id]);
    return narrate(next, `${active[0].name} wins — everyone else folded.`);
  }),

  botGoFishTurn: withSession((session) => {
    const current = session.players[session.turnIndex];
    if (!current || current.kind !== "bot") return session;

    let next = session;
    const books = collectSets(next, current.id, 4);
    next = books.session;

    const rank = mostCommonRank(next, current.id);
    if (!rank) {
      if (cardsInZone(next, "stock").length > 0) {
        next = draw(next, current.id, 1, "hidden");
      }
      return rotateTurn(next);
    }

    const targets = next.players.filter((p) => p.id !== current.id);
    // Prefer asking the human; else first other seat
    const target = targets.find((p) => p.id === "human") ?? targets[0];
    if (!target) return rotateTurn(next);

    const has = cardsInZone(next, "hand", target.id).some((c) => c.rank === rank);
    if (has) {
      next = transfer(next, {
        from: target.id,
        to: current.id,
        rank,
        fromZone: "hand",
        toZone: "hand",
        visibility: "hidden",
      });
      const again = collectSets(next, current.id, 4);
      next = again.session;
      next = narrate(
        next,
        `${current.name} asked ${target.name} for ${rank}s and got them.`,
      );
      return next; // keep bot turn — caller may re-enter
    }

    if (cardsInZone(next, "stock").length > 0) {
      next = draw(next, current.id, 1, "hidden");
    }
    next = narrate(
      next,
      `${current.name} asked ${target.name} for ${rank}s — go fish.`,
    );
    return rotateTurn(next);
  }),

  /** Play bots until it is the human's turn again (Go Fish). */
  botsUntilHuman: withSession((session) => {
    let next = session;
    for (let i = 0; i < 12; i++) {
      const cur = next.players[next.turnIndex];
      if (!cur || cur.kind === "human") break;
      // inline one bot step
      const books = collectSets(next, cur.id, 4);
      next = books.session;
      const rank = mostCommonRank(next, cur.id);
      if (!rank) {
        if (cardsInZone(next, "stock").length > 0) {
          next = draw(next, cur.id, 1, "hidden");
        }
        next = rotateTurn(next);
        continue;
      }
      const targets = next.players.filter((p) => p.id !== cur.id);
      const target = targets.find((p) => p.id === "human") ?? targets[0];
      if (!target) {
        next = rotateTurn(next);
        continue;
      }
      const has = cardsInZone(next, "hand", target.id).some(
        (c) => c.rank === rank,
      );
      if (has) {
        next = transfer(next, {
          from: target.id,
          to: cur.id,
          rank,
          fromZone: "hand",
          toZone: "hand",
          visibility: "hidden",
        });
        next = collectSets(next, cur.id, 4).session;
        next = narrate(
          next,
          `${cur.name} took ${rank}s from ${target.name}.`,
        );
        // bot keeps turn
      } else {
        if (cardsInZone(next, "stock").length > 0) {
          next = draw(next, cur.id, 1, "hidden");
        }
        next = narrate(next, `${cur.name} went fishing for ${rank}s.`);
        next = rotateTurn(next);
      }
    }
    return next;
  }),

  botCrazyEightsTurn: withSession((session) => {
    let next = session;
    for (let i = 0; i < 8; i++) {
      const cur = next.players[next.turnIndex];
      if (!cur || cur.kind === "human") break;
      const legal = firstLegalCrazyEight(next, cur.id);
      if (legal) {
        next = discard(next, cur.id, [legal], "public");
        next = narrate(next, `${cur.name} played a card.`);
        if (cardsInZone(next, "hand", cur.id).length === 0) {
          next = narrate(next, `${cur.name} wins!`);
          return next;
        }
        next = rotateTurn(next);
      } else if (cardsInZone(next, "stock").length > 0) {
        next = draw(next, cur.id, 1, "hidden");
        next = narrate(next, `${cur.name} drew.`);
        // after draw, try once more or pass
        const again = firstLegalCrazyEight(next, cur.id);
        if (again) {
          next = discard(next, cur.id, [again], "public");
          next = narrate(next, `${cur.name} played after drawing.`);
        }
        next = rotateTurn(next);
      } else {
        next = rotateTurn(next);
      }
    }
    return next;
  }),

  /** Seed discard with one stock card after deal (Crazy Eights). */
  flipStarterDiscard: withSession((session) => {
    const stock = cardsInZone(session, "stock");
    if (!stock.length) return session;
    return discard(
      {
        ...session,
        cards: session.cards.map((c) =>
          c.id === stock[0].id
            ? { ...c, location: { zone: "hand", ownerId: "human" } }
            : c,
        ),
      },
      "human",
      [stock[0].id],
      "public",
    );
  }),

  dealStarterDiscard: withSession((session) => {
    // Move top stock card directly to discard face-up
    const stock = cardsInZone(session, "stock");
    if (!stock.length) return session;
    const topId = stock[0].id;
    return {
      ...session,
      cards: session.cards.map((c) =>
        c.id === topId
          ? {
              ...c,
              location: { zone: "discard" as const },
              visibility: "public" as const,
            }
          : c,
      ),
    };
  }),

  botSimplePlayOrDraw: withSession((session) => {
    // Gin / generic: bot draws then discards a random card
    let next = session;
    for (let i = 0; i < 6; i++) {
      const cur = next.players[next.turnIndex];
      if (!cur || cur.kind === "human") break;
      if (cardsInZone(next, "stock").length > 0) {
        next = draw(next, cur.id, 1, "hidden");
      }
      const hand = cardsInZone(next, "hand", cur.id);
      if (hand.length > 0) {
        next = discard(next, cur.id, [hand[hand.length - 1].id], "public");
        next = narrate(next, `${cur.name} drew and discarded.`);
      }
      next = rotateTurn(next);
    }
    return next;
  }),

  botBullshitPlay: withSession((session) => {
    let next = session;
    for (let i = 0; i < 6; i++) {
      const cur = next.players[next.turnIndex];
      if (!cur || cur.kind === "human") break;
      const hand = cardsInZone(next, "hand", cur.id);
      if (!hand.length) {
        next = narrate(next, `${cur.name} is out — wins!`);
        return next;
      }
      const count = Math.min(1, hand.length);
      const ids = hand.slice(0, count).map((c) => c.id);
      next = play(next, cur.id, ids, "hidden");
      next = narrate(next, `${cur.name} played ${count} card(s) face-down.`);
      next = rotateTurn(next);
    }
    return next;
  }),

  euchreBotsPlayTrick: withSession((session) => {
    let next = session;
    for (let i = 0; i < 6; i++) {
      const cur = next.players[next.turnIndex];
      if (!cur || cur.kind === "human") break;
      const hand = cardsInZone(next, "hand", cur.id);
      if (!hand.length) {
        next = rotateTurn(next);
        continue;
      }
      next = play(next, cur.id, [hand[0].id], "public");
      next = narrate(next, `${cur.name} played.`);
      next = rotateTurn(next);
    }
    return next;
  }),

  sweepTrickToWinner: withSession((session) => {
    const winners = warPlayWinners(session);
    if (winners.length !== 1) {
      return narrate(session, "Trick tied — leave cards in play.");
    }
    return sweepZone(session, {
      fromZone: "play",
      to: "winner",
      toZone: "capture",
      visibility: "hidden",
    });
  }),
} as const;

/** Shared XState guards referenced by preset JSON. */
export const gameGuards = {
  always: () => true,

  handBusted: ({ context }: { context: Ctx }, params: Record<string, unknown>) => {
    const scoring: HandScoring = {
      aceAlt: Number(params.aceAlt ?? 11),
      bustOver: Number(params.bustOver ?? 21),
    };
    return scoreHand(context.session, "human", scoring).busted;
  },

  handScoreEq: ({ context }: { context: Ctx }, params: Record<string, unknown>) => {
    const scoring: HandScoring = {
      aceAlt: Number(params.aceAlt ?? 11),
      bustOver: Number(params.bustOver ?? 21),
    };
    return (
      scoreHand(context.session, "human", scoring).total ===
      Number(params.value ?? 21)
    );
  },

  handScoreGte: ({ context }: { context: Ctx }, params: Record<string, unknown>) => {
    const scoring: HandScoring = {
      aceAlt: Number(params.aceAlt ?? 11),
      bustOver: Number(params.bustOver ?? 21),
    };
    return (
      scoreHand(context.session, String(params.playerId ?? "human"), scoring)
        .total >= Number(params.value ?? 17)
    );
  },

  zoneCountEq: ({ context }: { context: Ctx }, params: Record<string, unknown>) => {
    return evaluateCondition(
      context.session,
      {
        subject: "zone_count",
        zone: (params.zone as "play") ?? "play",
        op: "eq",
        value: Number(params.value ?? 0),
      },
      "human",
    );
  },

  stockEmpty: ({ context }: { context: Ctx }) =>
    cardsInZone(context.session, "stock").length === 0,

  warIsTie: ({ context }: { context: Ctx }) => {
    const winners = warPlayWinners(context.session);
    return winners.length !== 1;
  },

  warHasWinner: ({ context }: { context: Ctx }) =>
    warPlayWinners(context.session).length === 1,

  playEmpty: ({ context }: { context: Ctx }) =>
    cardsInZone(context.session, "play").length === 0,

  humanHandEmpty: ({ context }: { context: Ctx }) =>
    cardsInZone(context.session, "hand", "human").length === 0,

  askTargetHasRank: (
    { context, event }: { context: Ctx; event: Ev },
    params: Record<string, unknown>,
  ) => {
    const from = String(params.from ?? "bot_1");
    const selected = event.selectedCardIds?.[0];
    const card = selected
      ? context.session.cards.find((c) => c.id === selected)
      : undefined;
    if (!card) return false;
    return cardsInZone(context.session, "hand", from).some(
      (c) => c.rank === card.rank,
    );
  },

  isHumanTurn: ({ context }: { context: Ctx }) => {
    const cur = context.session.players[context.session.turnIndex];
    return cur?.kind === "human";
  },

  isBotTurn: ({ context }: { context: Ctx }) => {
    const cur = context.session.players[context.session.turnIndex];
    return cur?.kind === "bot";
  },

  onlyOneActive: ({ context }: { context: Ctx }) =>
    context.session.players.filter((p) => !p.folded).length === 1,

  boardCountEq: ({ context }: { context: Ctx }, params: Record<string, unknown>) =>
    cardsInZone(context.session, "play").length === Number(params.value ?? 0),

  humanHasBooks: ({ context }: { context: Ctx }) =>
    findSets(context.session, "human", 4).length > 0,

  condition: (
    { context }: { context: Ctx },
    params: Record<string, unknown>,
  ) =>
    evaluateCondition(
      context.session,
      {
        subject: (params.subject as "always") ?? "always",
        op: params.op as "eq" | undefined,
        value: params.value as number | undefined,
        zone: params.zone as "play" | undefined,
        playerId: params.playerId as string | undefined,
        scoring: params.scoring as HandScoring | undefined,
      },
      "human",
    ),
} as const;
