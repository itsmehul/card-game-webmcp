import { describe, it, expect } from "vitest";
import { startPresetWithActor } from "@/lib/game/presets";
import { sendHumanEvent } from "@/lib/game/machine";
import { cardsInZone } from "@/lib/game/scoring";
import { comparePokerRanks, evaluateBestHand } from "@/lib/game/poker";
import type { Card } from "@/lib/game/types";

describe("blackjack machine", () => {
  it("bets, deals, stands, and settles", () => {
    const { session: initial, actor } = startPresetWithActor("blackjack");
    expect(initial.phase).toBe("waiting_for_bet");
    expect(initial.legalActions.map((a) => a.id)).toContain("bet");

    let s = sendHumanEvent(actor, "BET");
    expect(s.phase).toBe("waiting_to_deal");
    expect(s.chips?.pot).toBe(10);

    s = sendHumanEvent(actor, "DEAL");
    expect(s.phase).toBe("player_act");
    expect(cardsInZone(s, "hand", "human")).toHaveLength(2);

    s = sendHumanEvent(actor, "STAND");
    expect(s.phase).toBe("hand_over");
    expect(s.legalActions.map((a) => a.id)).toContain("new_hand");
    expect(s.chips!.pot).toBe(0);
    actor.stop();
  });
});

describe("war machine", () => {
  it("deals and flips", () => {
    const { actor } = startPresetWithActor("war");
    let s = sendHumanEvent(actor, "DEAL");
    expect(s.phase).toBe("ready_to_flip");
    expect(cardsInZone(s, "hand", "human")).toHaveLength(26);

    s = sendHumanEvent(actor, "FLIP");
    expect(["ready_to_flip", "war_tie", "out_of_cards"]).toContain(s.phase);
    actor.stop();
  });
});

describe("holdem machine", () => {
  it("posts blinds, deals, and advances to flop after call", () => {
    const { actor } = startPresetWithActor("texas-holdem");
    let s = sendHumanEvent(actor, "DEAL");
    expect(s.phase).toBe("preflop");
    expect(s.chips!.pot).toBeGreaterThan(0);
    expect(cardsInZone(s, "hand", "human")).toHaveLength(2);

    s = sendHumanEvent(actor, "CALL");
    expect(s.phase).toBe("flop");
    expect(cardsInZone(s, "play")).toHaveLength(3);
    actor.stop();
  });
});

describe("poker evaluator", () => {
  function c(rank: Card["rank"], suit: Card["suit"], id: string): Card {
    return {
      id,
      rank,
      suit,
      location: { zone: "hand", ownerId: "human" },
      visibility: "public",
    };
  }

  it("ranks a flush above a straight", () => {
    const flush = evaluateBestHand([
      c("2", "hearts", "a"),
      c("5", "hearts", "b"),
      c("7", "hearts", "c"),
      c("9", "hearts", "d"),
      c("K", "hearts", "e"),
    ]);
    const straight = evaluateBestHand([
      c("5", "clubs", "f"),
      c("6", "diamonds", "g"),
      c("7", "hearts", "h"),
      c("8", "spades", "i"),
      c("9", "clubs", "j"),
    ]);
    expect(comparePokerRanks(flush, straight)).toBeGreaterThan(0);
  });
});

describe("all catalog machines boot", () => {
  const ids = [
    "texas-holdem",
    "blackjack",
    "war",
    "go-fish",
    "crazy-eights",
    "euchre",
    "gin-rummy",
    "bullshit",
  ];
  for (const id of ids) {
    it(`boots ${id}`, () => {
      const { session, actor } = startPresetWithActor(id);
      expect(session.legalActions.length).toBeGreaterThan(0);
      expect(session.legalActions.every((a) => a.event)).toBe(true);
      actor.stop();
    });
  }
});

describe("blackjack turn ownership", () => {
  it("returns turn to human after stand settles", () => {
    const { actor } = startPresetWithActor("blackjack");
    let s = sendHumanEvent(actor, "BET");
    s = sendHumanEvent(actor, "DEAL");
    s = sendHumanEvent(actor, "STAND");
    expect(s.phase).toBe("hand_over");
    expect(s.players[s.turnIndex]?.id).toBe("human");
    expect(s.legalActions.map((a) => a.id)).toContain("new_hand");
    actor.stop();
  });

  it("returns turn to human after bust settles", () => {
    const { actor } = startPresetWithActor("blackjack");
    let s = sendHumanEvent(actor, "BET");
    s = sendHumanEvent(actor, "DEAL");
    for (let i = 0; i < 12 && s.phase === "player_act"; i++) {
      s = sendHumanEvent(actor, "HIT");
    }
    if (s.phase === "player_act") {
      s = sendHumanEvent(actor, "STAND");
    }
    expect(s.phase).toBe("hand_over");
    expect(s.players[s.turnIndex]?.id).toBe("human");
    expect(s.legalActions.map((a) => a.id)).toContain("new_hand");
    actor.stop();
  });
});
