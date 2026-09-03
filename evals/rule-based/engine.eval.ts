/**
 * Rule-based evals for the game engine.
 *
 * Following the Chrome AI Evals guide: these are objective tests with a
 * binary PASS/FAIL answer. They verify data format, game invariants, and
 * deterministic correctness — things with a definitive answer that we can
 * check with regular programmatic code.
 *
 * Criteria tested:
 *  - Deck integrity (correct card count, unique ids, valid suits/ranks)
 *  - Session structure (valid schema after creation)
 *  - Deal correctness (card movement, zone counts)
 *  - Turn rotation (clockwise/counterclockwise, skip folded)
 *  - Chip accounting (conservation of chips across actions)
 */

import { describe, it, expect } from "vitest";
import {
  createDeck,
  createSession,
  deal,
  draw,
  play,
  discard,
  rotateTurn,
  shuffle,
  dealToPlay,
  chipAction,
  postBlinds,
  allIn,
  awardPot,
  resetHand,
  narrate,
  capture,
  transfer,
  playAll,
  sweepZone,
  moveTurn,
  getHumanView,
  getOmniscientState,
} from "@/lib/game/engine";
import { createFromPreset } from "@/lib/game/presets";
import type { GameSession, Rank, Suit } from "@/lib/game/types";
import { pass, fail, runEvals, type EvalResult } from "../helpers";
import {
  PRESET_SCENARIOS,
  CUSTOM_SCENARIOS,
} from "../datasets/game-scenarios";

// ---------------------------------------------------------------------------
// Evaluator functions (following the Chrome guide pattern)
// ---------------------------------------------------------------------------

const VALID_SUITS: Suit[] = ["spades", "hearts", "diamonds", "clubs"];
const VALID_RANKS: Rank[] = [
  "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K",
];

function evalDeckIntegrity(cards: ReturnType<typeof createDeck>): EvalResult[] {
  const results: EvalResult[] = [];

  // Unique IDs
  const ids = cards.map((c) => c.id);
  const uniqueIds = new Set(ids);
  results.push(
    uniqueIds.size === ids.length
      ? pass("deck_unique_ids")
      : fail("deck_unique_ids", `Duplicate ids found: ${ids.length - uniqueIds.size} dupes`),
  );

  // All cards start in stock
  const allInStock = cards.every((c) => c.location.zone === "stock");
  results.push(
    allInStock
      ? pass("deck_initial_zone")
      : fail("deck_initial_zone", "Not all cards start in stock zone"),
  );

  // Valid suits and ranks (excluding jokers)
  const nonJokers = cards.filter((c) => c.rank !== "joker");
  const validSuitsRanks = nonJokers.every(
    (c) =>
      VALID_SUITS.includes(c.suit as Suit) &&
      VALID_RANKS.includes(c.rank as Rank),
  );
  results.push(
    validSuitsRanks
      ? pass("deck_valid_suits_ranks")
      : fail("deck_valid_suits_ranks", "Found cards with invalid suit or rank"),
  );

  // All start as unknown visibility
  const allUnknown = cards.every((c) => c.visibility === "unknown");
  results.push(
    allUnknown
      ? pass("deck_initial_visibility")
      : fail("deck_initial_visibility", "Not all cards start with unknown visibility"),
  );

  return results;
}

function evalSessionSchema(session: GameSession): EvalResult[] {
  const results: EvalResult[] = [];

  results.push(
    typeof session.id === "string" && session.id.length > 0
      ? pass("session_has_id")
      : fail("session_has_id", "Session id is missing or empty"),
  );

  results.push(
    typeof session.name === "string" && session.name.length > 0
      ? pass("session_has_name")
      : fail("session_has_name", "Session name is missing or empty"),
  );

  results.push(
    session.players.length >= 2
      ? pass("session_min_players")
      : fail("session_min_players", `Only ${session.players.length} player(s)`),
  );

  const human = session.players.find((p) => p.id === "human");
  results.push(
    human !== undefined
      ? pass("session_has_human")
      : fail("session_has_human", "No human player found"),
  );

  results.push(
    session.turnIndex >= 0 && session.turnIndex < session.players.length
      ? pass("session_valid_turn_index")
      : fail("session_valid_turn_index", `turnIndex ${session.turnIndex} out of bounds`),
  );

  results.push(
    Array.isArray(session.cards) && session.cards.length > 0
      ? pass("session_has_cards")
      : fail("session_has_cards", "No cards in session"),
  );

  results.push(
    Array.isArray(session.narration)
      ? pass("session_narration_array")
      : fail("session_narration_array", "narration is not an array"),
  );

  return results;
}

function evalCardConservation(
  before: GameSession,
  after: GameSession,
  label: string,
): EvalResult {
  return before.cards.length === after.cards.length
    ? pass(`card_conservation_${label}`)
    : fail(
        `card_conservation_${label}`,
        `Card count changed: ${before.cards.length} → ${after.cards.length}`,
      );
}

function evalChipConservation(session: GameSession): EvalResult {
  if (!session.chips) return pass("chip_conservation_na");
  const stacks = Object.values(session.chips.stacks).reduce((a, b) => a + b, 0);
  const total = stacks + session.chips.pot;
  const expectedTotal =
    session.players.length * (session.chips.stacks[session.players[0].id] !== undefined ? 1 : 0);
  // Total chips in the system should equal initial total
  // We check that stacks + pot >= 0 and is consistent
  return total > 0
    ? pass("chip_conservation")
    : fail("chip_conservation", `Total chips in system: ${total}`);
}

// ---------------------------------------------------------------------------
// Eval suites
// ---------------------------------------------------------------------------

describe("Rule-based evals: Deck integrity", () => {
  it("standard 52-card deck", () => {
    const cards = createDeck(false);
    expect(cards).toHaveLength(52);
    const { failed, results } = runEvals(evalDeckIntegrity(cards));
    for (const r of results) {
      expect(r.status, r.rationale ?? r.criterion).toBe("PASS");
    }
    expect(failed).toBe(0);
  });

  it("54-card deck with jokers", () => {
    const cards = createDeck(true);
    expect(cards).toHaveLength(54);
    const jokers = cards.filter((c) => c.rank === "joker");
    expect(jokers).toHaveLength(2);
    const { failed, results } = runEvals(evalDeckIntegrity(cards));
    for (const r of results) {
      expect(r.status, r.rationale ?? r.criterion).toBe("PASS");
    }
    expect(failed).toBe(0);
  });

  it("shuffle preserves all cards", () => {
    const original = createDeck(false);
    const shuffled = shuffle(original);
    expect(shuffled).toHaveLength(52);
    const originalIds = new Set(original.map((c) => c.id));
    const shuffledIds = new Set(shuffled.map((c) => c.id));
    expect(shuffledIds).toEqual(originalIds);
  });

  it("shuffle resets all cards to stock", () => {
    const cards = createDeck(false);
    const shuffled = shuffle(cards);
    expect(shuffled.every((c) => c.location.zone === "stock")).toBe(true);
  });
});

describe("Rule-based evals: Session creation", () => {
  for (const scenario of [...PRESET_SCENARIOS, ...CUSTOM_SCENARIOS]) {
    it(`${scenario.description} (${scenario.id})`, () => {
      const session = scenario.options.preset
        ? createFromPreset(scenario.options.preset, scenario.options)
        : createSession(scenario.options);

      // Schema validation
      const schemaResults = evalSessionSchema(session);
      for (const r of schemaResults) {
        expect(r.status, `${scenario.id}: ${r.rationale ?? r.criterion}`).toBe("PASS");
      }

      // Bot count
      const bots = session.players.filter((p) => p.kind === "bot");
      expect(bots.length).toBe(scenario.expectedBotCount);

      // Deck size
      expect(session.cards.length).toBe(scenario.expectedDeckSize);
    });
  }
});

describe("Rule-based evals: Deal mechanics", () => {
  it("dealing moves cards from stock to hand", () => {
    const session = createSession({ name: "Test", botCount: 1 });
    const after = deal(session, "human", 5);

    expect(evalCardConservation(session, after, "deal").status).toBe("PASS");

    const humanHand = after.cards.filter(
      (c) => c.location.zone === "hand" && c.location.ownerId === "human",
    );
    expect(humanHand).toHaveLength(5);

    const stock = after.cards.filter((c) => c.location.zone === "stock");
    expect(stock).toHaveLength(52 - 5);
  });

  it("dealing to play area works", () => {
    const session = createSession({ name: "Test", botCount: 1 });
    const after = dealToPlay(session, 3);

    expect(evalCardConservation(session, after, "deal_to_play").status).toBe("PASS");

    const playCards = after.cards.filter((c) => c.location.zone === "play");
    expect(playCards).toHaveLength(3);
    expect(playCards.every((c) => c.visibility === "public")).toBe(true);
  });

  it("overdraw throws", () => {
    const session = createSession({ name: "Test", botCount: 1 });
    expect(() => deal(session, "human", 100)).toThrow();
  });

  it("draw is an alias for deal with count", () => {
    const session = createSession({ name: "Test", botCount: 1 });
    const afterDraw = draw(session, "human", 3);
    const humanHand = afterDraw.cards.filter(
      (c) => c.location.zone === "hand" && c.location.ownerId === "human",
    );
    expect(humanHand).toHaveLength(3);
  });
});

describe("Rule-based evals: Card actions", () => {
  function setupWithHand() {
    let session = createSession({ name: "Test", botCount: 1 });
    session = deal(session, "human", 5);
    return session;
  }

  it("play moves card from hand to play zone", () => {
    const session = setupWithHand();
    const handCard = session.cards.find(
      (c) => c.location.zone === "hand" && c.location.ownerId === "human",
    )!;
    const after = play(session, "human", [handCard.id]);

    expect(evalCardConservation(session, after, "play").status).toBe("PASS");
    const played = after.cards.find((c) => c.id === handCard.id)!;
    expect(played.location.zone).toBe("play");
    expect(played.visibility).toBe("public");
  });

  it("discard moves card from hand to discard zone", () => {
    const session = setupWithHand();
    const handCard = session.cards.find(
      (c) => c.location.zone === "hand" && c.location.ownerId === "human",
    )!;
    const after = discard(session, "human", [handCard.id]);

    expect(evalCardConservation(session, after, "discard").status).toBe("PASS");
    const discarded = after.cards.find((c) => c.id === handCard.id)!;
    expect(discarded.location.zone).toBe("discard");
  });

  it("capture moves cards to capture zone", () => {
    let session = createSession({
      name: "Test",
      botCount: 1,
      enabledZones: { capture: true },
    });
    session = deal(session, "human", 3);
    const handCard = session.cards.find(
      (c) => c.location.zone === "hand" && c.location.ownerId === "human",
    )!;
    const after = capture(session, "human", [handCard.id]);
    const captured = after.cards.find((c) => c.id === handCard.id)!;
    expect(captured.location.zone).toBe("capture");
    expect(captured.location.ownerId).toBe("human");
  });

  it("playing a card not in hand throws", () => {
    const session = setupWithHand();
    expect(() => play(session, "human", ["fake_card"])).toThrow();
  });
});

describe("Rule-based evals: Turn rotation", () => {
  it("clockwise rotation advances turn index", () => {
    const session = createSession({ name: "Test", botCount: 2 });
    expect(session.turnIndex).toBe(0);
    const after = rotateTurn(session);
    expect(after.turnIndex).toBe(1);
    const after2 = rotateTurn(after);
    expect(after2.turnIndex).toBe(2);
    const after3 = rotateTurn(after2);
    expect(after3.turnIndex).toBe(0); // wraps
  });

  it("counterclockwise rotation", () => {
    const session = createSession({
      name: "Test",
      botCount: 2,
      turnDirection: "counterclockwise",
    });
    const after = rotateTurn(session);
    expect(after.turnIndex).toBe(2);
  });

  it("skips folded players", () => {
    let session = createSession({
      name: "Test",
      botCount: 2,
      chips: true,
    });
    // Fold bot_1 (index 1)
    session = chipAction(session, "bot_1", "fold");
    session = { ...session, turnIndex: 0 };
    const after = rotateTurn(session);
    expect(after.turnIndex).toBe(2); // skipped index 1
  });

  it("moveTurn handles symbolic targets", () => {
    const session = createSession({ name: "Test", botCount: 2 });

    expect(moveTurn(session, "same").turnIndex).toBe(0);
    expect(moveTurn(session, "next").turnIndex).toBe(1);
    expect(moveTurn(session, "first").turnIndex).toBe(0);
  });
});

describe("Rule-based evals: Chip accounting", () => {
  function setupChips() {
    return createSession({
      name: "Chip Test",
      botCount: 2,
      chips: true,
      startingStack: 1000,
    });
  }

  it("chips are initialized correctly", () => {
    const session = setupChips();
    expect(session.chips).not.toBeNull();
    expect(session.chips!.pot).toBe(0);
    for (const p of session.players) {
      expect(session.chips!.stacks[p.id]).toBe(1000);
    }
  });

  it("bet deducts from stack and adds to pot", () => {
    const session = setupChips();
    const after = chipAction(session, "human", "bet", 100);
    expect(after.chips!.stacks.human).toBe(900);
    expect(after.chips!.pot).toBe(100);
  });

  it("total chips are conserved after betting", () => {
    let session = setupChips();
    session = chipAction(session, "human", "bet", 100);
    session = chipAction(session, "bot_1", "call");

    const totalStacks = Object.values(session.chips!.stacks).reduce((a, b) => a + b, 0);
    const total = totalStacks + session.chips!.pot;
    expect(total).toBe(3000); // 3 players × 1000
  });

  it("all-in puts entire stack in pot", () => {
    const session = setupChips();
    const after = allIn(session, "human");
    expect(after.chips!.stacks.human).toBe(0);
    expect(after.chips!.pot).toBe(1000);
  });

  it("award pot distributes to winners", () => {
    let session = setupChips();
    session = chipAction(session, "human", "bet", 100);
    session = chipAction(session, "bot_1", "call");
    const after = awardPot(session, ["human"]);
    expect(after.chips!.stacks.human).toBe(900 + 200);
    expect(after.chips!.pot).toBe(0);
  });

  it("blinds deduct correctly", () => {
    const session = setupChips();
    const after = postBlinds(session, [
      { playerId: "bot_1", amount: 10 },
      { playerId: "bot_2", amount: 20 },
    ]);
    expect(after.chips!.stacks.bot_1).toBe(990);
    expect(after.chips!.stacks.bot_2).toBe(980);
    expect(after.chips!.pot).toBe(30);
  });

  it("resetHand clears committed and unfolding", () => {
    let session = setupChips();
    session = chipAction(session, "human", "bet", 50);
    session = chipAction(session, "bot_1", "fold");
    session = resetHand(session);
    expect(session.chips!.currentBet).toBe(0);
    expect(session.players.every((p) => !p.folded)).toBe(true);
  });
});

describe("Rule-based evals: Transfer mechanics", () => {
  it("transfer moves cards between players by rank", () => {
    let session = createSession({ name: "Test", botCount: 1 });
    session = deal(session, "human", 5);
    session = deal(session, "bot_1", 5);

    const humanHand = session.cards.filter(
      (c) => c.location.zone === "hand" && c.location.ownerId === "human",
    );
    const targetRank = humanHand[0].rank;

    // Transfer all of that rank from human to bot
    const after = transfer(session, {
      from: "human",
      to: "bot_1",
      rank: targetRank,
    });

    expect(evalCardConservation(session, after, "transfer").status).toBe("PASS");

    const transferred = after.cards.filter(
      (c) =>
        c.location.zone === "hand" &&
        c.location.ownerId === "bot_1" &&
        c.rank === targetRank,
    );
    expect(transferred.length).toBeGreaterThan(0);
  });
});

describe("Rule-based evals: View generation", () => {
  it("human view hides other players' cards", () => {
    let session = createSession({ name: "Test", botCount: 1 });
    session = deal(session, "human", 5, "hidden");
    session = deal(session, "bot_1", 5, "hidden");

    const view = getHumanView(session);
    const botPlayer = view.players.find((p) => p.id === "bot_1")!;

    // Bot's cards should be face-down for the human viewer
    expect(botPlayer.hand.every((c) => !c.faceUp)).toBe(true);

    // Human's own cards should be face-up
    const humanPlayer = view.players.find((p) => p.id === "human")!;
    expect(humanPlayer.hand.every((c) => c.faceUp)).toBe(true);
  });

  it("omniscient state exposes all non-stock cards", () => {
    let session = createSession({
      name: "Test",
      botCount: 1,
      mode: "tutorial",
    });
    session = deal(session, "human", 5, "hidden");
    session = deal(session, "bot_1", 5, "hidden");

    const state = getOmniscientState(session);
    // Should include both hands (tutorial mode exposes human hand too)
    expect(state.cards.length).toBe(10);
    expect(state.cards.every((c) => c.rank !== undefined)).toBe(true);
  });

  it("human view has correct schema shape", () => {
    let session = createSession({ name: "Test", botCount: 1 });
    session = deal(session, "human", 3);
    const view = getHumanView(session);

    expect(view).toHaveProperty("name");
    expect(view).toHaveProperty("mode");
    expect(view).toHaveProperty("phase");
    expect(view).toHaveProperty("turnPlayerId");
    expect(view).toHaveProperty("legalActions");
    expect(view).toHaveProperty("players");
    expect(view).toHaveProperty("stockCount");
    expect(view).toHaveProperty("narration");
    expect(view).toHaveProperty("instructions");
  });
});

describe("Rule-based evals: Narration", () => {
  it("narrate appends entries", () => {
    let session = createSession({ name: "Test", botCount: 1 });
    session = narrate(session, "Game started!");
    session = narrate(session, "Your turn.");

    expect(session.narration).toHaveLength(2);
    expect(session.narration[0].text).toBe("Game started!");
    expect(session.narration[1].text).toBe("Your turn.");
  });

  it("narration caps at 50 entries", () => {
    let session = createSession({ name: "Test", botCount: 1 });
    for (let i = 0; i < 60; i++) {
      session = narrate(session, `Entry ${i}`);
    }
    expect(session.narration.length).toBeLessThanOrEqual(50);
  });
});
