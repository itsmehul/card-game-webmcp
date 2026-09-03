/**
 * Rule-based evals for the scoring module.
 *
 * These evals verify that hand scoring, rank comparisons, and set detection
 * produce deterministically correct results against known test data.
 *
 * Criteria:
 *  - Blackjack hand totals match expected values
 *  - Bust detection is accurate
 *  - Soft hand detection is accurate
 *  - Rank ordering is correct
 *  - Set detection (pairs, books) works correctly
 *  - Zone comparison picks correct winners
 */

import { describe, it, expect } from "vitest";
import {
  rankOrder,
  defaultRankValue,
  scoreHand,
  compareZone,
  findSets,
} from "@/lib/game/scoring";
import { createSession, deal, play } from "@/lib/game/engine";
import type { Rank, HandScoring } from "@/lib/game/types";
import { pass, fail, runEvals, type EvalResult } from "../helpers";
import { BLACKJACK_SCORING_SCENARIOS } from "../datasets/game-scenarios";

// ---------------------------------------------------------------------------
// Evaluators
// ---------------------------------------------------------------------------

function evalRankOrdering(): EvalResult[] {
  const results: EvalResult[] = [];

  // Aces should be highest (except jokers)
  const aceOrder = rankOrder("A");
  const kingOrder = rankOrder("K");
  results.push(
    aceOrder > kingOrder
      ? pass("ace_beats_king")
      : fail("ace_beats_king", `Ace order ${aceOrder} <= King order ${kingOrder}`),
  );

  // Jokers beat aces
  const jokerOrder = rankOrder("joker");
  results.push(
    jokerOrder > aceOrder
      ? pass("joker_beats_ace")
      : fail("joker_beats_ace", `Joker order ${jokerOrder} <= Ace order ${aceOrder}`),
  );

  // 2 is lowest
  const twoOrder = rankOrder("2");
  results.push(
    twoOrder === 0
      ? pass("two_is_lowest")
      : fail("two_is_lowest", `2 has order ${twoOrder}, expected 0`),
  );

  // Monotonic increase from 2 to A
  const ranks: Rank[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  let monotonic = true;
  for (let i = 1; i < ranks.length; i++) {
    if (rankOrder(ranks[i]) <= rankOrder(ranks[i - 1])) {
      monotonic = false;
      break;
    }
  }
  results.push(
    monotonic
      ? pass("rank_order_monotonic")
      : fail("rank_order_monotonic", "Rank ordering is not strictly increasing"),
  );

  return results;
}

function evalDefaultValues(): EvalResult[] {
  const results: EvalResult[] = [];

  results.push(
    defaultRankValue("A") === 1
      ? pass("ace_default_value")
      : fail("ace_default_value", `Ace = ${defaultRankValue("A")}, expected 1`),
  );

  results.push(
    defaultRankValue("K") === 10
      ? pass("king_default_value")
      : fail("king_default_value", `King = ${defaultRankValue("K")}, expected 10`),
  );

  results.push(
    defaultRankValue("5") === 5
      ? pass("five_default_value")
      : fail("five_default_value", `5 = ${defaultRankValue("5")}, expected 5`),
  );

  results.push(
    defaultRankValue("joker") === 0
      ? pass("joker_default_value")
      : fail("joker_default_value", `Joker = ${defaultRankValue("joker")}, expected 0`),
  );

  return results;
}

// ---------------------------------------------------------------------------
// Eval suites
// ---------------------------------------------------------------------------

describe("Rule-based evals: Rank ordering", () => {
  it("rank order is correct", () => {
    const { failed, results } = runEvals(evalRankOrdering());
    for (const r of results) {
      expect(r.status, r.rationale ?? r.criterion).toBe("PASS");
    }
    expect(failed).toBe(0);
  });

  it("default rank values are correct", () => {
    const { failed, results } = runEvals(evalDefaultValues());
    for (const r of results) {
      expect(r.status, r.rationale ?? r.criterion).toBe("PASS");
    }
    expect(failed).toBe(0);
  });
});

describe("Rule-based evals: Blackjack hand scoring", () => {
  for (const scenario of BLACKJACK_SCORING_SCENARIOS) {
    it(`${scenario.description} (${scenario.id})`, () => {
      // Build a session and manually place cards with known ranks
      let session = createSession({ name: "BJ Test", botCount: 1 });

      // Place specific cards into human's hand
      const suits = ["spades", "hearts", "diamonds", "clubs"] as const;
      session = {
        ...session,
        cards: session.cards.map((card, i) => {
          if (i < scenario.ranks.length) {
            return {
              ...card,
              rank: scenario.ranks[i] as Rank,
              suit: suits[i % 4],
              location: { zone: "hand" as const, ownerId: "human" },
              visibility: "hidden" as const,
            };
          }
          return card;
        }),
      };

      const scoring: HandScoring = scenario.scoring as HandScoring;
      const result = scoreHand(session, "human", scoring);

      expect(result.total).toBe(scenario.expectedTotal);
      expect(result.busted).toBe(scenario.expectedBusted);
      expect(result.soft).toBe(scenario.expectedSoft);
    });
  }
});

describe("Rule-based evals: Set detection", () => {
  it("finds books of four", () => {
    let session = createSession({ name: "Set Test", botCount: 1 });

    // Place four aces in human's hand
    session = {
      ...session,
      cards: session.cards.map((card) => {
        if (card.rank === "A") {
          return {
            ...card,
            location: { zone: "hand" as const, ownerId: "human" },
          };
        }
        return card;
      }),
    };

    const sets = findSets(session, "human", 4);
    expect(sets.length).toBe(1);
    expect(sets[0].rank).toBe("A");
    expect(sets[0].cardIds).toHaveLength(4);
  });

  it("finds pairs", () => {
    let session = createSession({ name: "Pair Test", botCount: 1 });

    // Place two kings in human's hand
    const kings = session.cards.filter((c) => c.rank === "K").slice(0, 2);
    session = {
      ...session,
      cards: session.cards.map((card) => {
        if (kings.some((k) => k.id === card.id)) {
          return {
            ...card,
            location: { zone: "hand" as const, ownerId: "human" },
          };
        }
        return card;
      }),
    };

    const sets = findSets(session, "human", 2);
    expect(sets.length).toBe(1);
    expect(sets[0].rank).toBe("K");
  });

  it("returns empty when no complete sets", () => {
    let session = createSession({ name: "No Set Test", botCount: 1 });
    session = deal(session, "human", 1);
    const sets = findSets(session, "human", 4);
    expect(sets).toHaveLength(0);
  });
});

describe("Rule-based evals: Zone comparison", () => {
  it("higher card wins", () => {
    let session = createSession({ name: "Compare Test", botCount: 1 });

    // Place a King for human and a 2 for bot in play zone
    const king = session.cards.find((c) => c.rank === "K")!;
    const two = session.cards.find((c) => c.rank === "2")!;

    session = {
      ...session,
      cards: session.cards.map((card) => {
        if (card.id === king.id) {
          return {
            ...card,
            location: { zone: "play" as const, ownerId: "human" },
            visibility: "public" as const,
          };
        }
        if (card.id === two.id) {
          return {
            ...card,
            location: { zone: "play" as const, ownerId: "bot_1" },
            visibility: "public" as const,
          };
        }
        return card;
      }),
    };

    const result = compareZone(session, "play");
    expect(result.winners).toContain("human");
    expect(result.winners).not.toContain("bot_1");
  });

  it("same rank is a tie", () => {
    let session = createSession({ name: "Tie Test", botCount: 1 });

    const kings = session.cards.filter((c) => c.rank === "K").slice(0, 2);

    session = {
      ...session,
      cards: session.cards.map((card) => {
        if (card.id === kings[0].id) {
          return {
            ...card,
            location: { zone: "play" as const, ownerId: "human" },
            visibility: "public" as const,
          };
        }
        if (card.id === kings[1].id) {
          return {
            ...card,
            location: { zone: "play" as const, ownerId: "bot_1" },
            visibility: "public" as const,
          };
        }
        return card;
      }),
    };

    const result = compareZone(session, "play");
    expect(result.winners).toHaveLength(2);
    expect(result.winners).toContain("human");
    expect(result.winners).toContain("bot_1");
  });
});
