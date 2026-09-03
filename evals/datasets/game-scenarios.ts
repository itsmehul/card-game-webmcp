/**
 * Eval datasets — known input/output pairs for rule-based evaluations.
 *
 * Each scenario defines a game setup and expected invariants that must
 * hold after executing the described actions. This is the "labeled dataset"
 * the Chrome AI Evals guide recommends as the source of truth.
 */

import type { CreateGameOptions } from "@/lib/game/types";

export interface GameScenario {
  id: string;
  description: string;
  options: CreateGameOptions;
  /** Number of bots expected (after creation) */
  expectedBotCount: number;
  /** Expected total card count in deck */
  expectedDeckSize: number;
}

/** Preset game scenarios with known correct configurations. */
export const PRESET_SCENARIOS: GameScenario[] = [
  {
    id: "texas-holdem-default",
    description: "Texas Hold'em with default settings",
    options: { preset: "texas-holdem" },
    expectedBotCount: 2,
    expectedDeckSize: 52,
  },
  {
    id: "blackjack-default",
    description: "Blackjack with default settings",
    options: { preset: "blackjack" },
    expectedBotCount: 1,
    expectedDeckSize: 52,
  },
  {
    id: "war-default",
    description: "War with default settings",
    options: { preset: "war" },
    expectedBotCount: 1,
    expectedDeckSize: 52,
  },
  {
    id: "go-fish-default",
    description: "Go Fish with default settings",
    options: { preset: "go-fish" },
    expectedBotCount: 2,
    expectedDeckSize: 52,
  },
  {
    id: "crazy-eights-default",
    description: "Crazy Eights with default settings",
    options: { preset: "crazy-eights" },
    expectedBotCount: 2,
    expectedDeckSize: 52,
  },
  {
    id: "euchre-default",
    description: "Euchre with default settings",
    options: { preset: "euchre" },
    expectedBotCount: 3,
    expectedDeckSize: 52,
  },
  {
    id: "gin-rummy-default",
    description: "Gin Rummy with default settings",
    options: { preset: "gin-rummy" },
    expectedBotCount: 1,
    expectedDeckSize: 52,
  },
  {
    id: "bullshit-default",
    description: "Bullshit with default settings",
    options: { preset: "bullshit" },
    expectedBotCount: 2,
    expectedDeckSize: 52,
  },
];

/** Custom game scenarios to test non-preset configurations. */
export const CUSTOM_SCENARIOS: GameScenario[] = [
  {
    id: "custom-3bot",
    description: "Custom game with 3 bots",
    options: { name: "Test Game", botCount: 3 },
    expectedBotCount: 3,
    expectedDeckSize: 52,
  },
  {
    id: "custom-jokers",
    description: "Custom game with jokers",
    options: { name: "Joker Game", botCount: 2, jokers: true },
    expectedBotCount: 2,
    expectedDeckSize: 54,
  },
  {
    id: "custom-1bot",
    description: "Custom 1v1 game",
    options: { name: "Heads Up", botCount: 1 },
    expectedBotCount: 1,
    expectedDeckSize: 52,
  },
  {
    id: "custom-chips",
    description: "Custom game with chips enabled",
    options: { name: "Chip Game", botCount: 2, chips: true, startingStack: 500 },
    expectedBotCount: 2,
    expectedDeckSize: 52,
  },
];

/** Scoring eval datasets — known hand configurations and expected totals. */
export interface ScoringScenario {
  id: string;
  description: string;
  ranks: string[];
  scoring: { values?: Record<string, number>; aceAlt?: number; bustOver?: number };
  expectedTotal: number;
  expectedBusted: boolean;
  expectedSoft: boolean;
}

export const BLACKJACK_SCORING_SCENARIOS: ScoringScenario[] = [
  {
    id: "bj-21",
    description: "Blackjack natural: Ace + King = 21",
    ranks: ["A", "K"],
    scoring: { values: { A: 1 }, aceAlt: 11, bustOver: 21 },
    expectedTotal: 21,
    expectedBusted: false,
    expectedSoft: true,
  },
  {
    id: "bj-hard-20",
    description: "Hard 20: King + Queen",
    ranks: ["K", "Q"],
    scoring: { values: { A: 1 }, aceAlt: 11, bustOver: 21 },
    expectedTotal: 20,
    expectedBusted: false,
    expectedSoft: false,
  },
  {
    id: "bj-bust",
    description: "Bust: King + Queen + 5 = 25",
    ranks: ["K", "Q", "5"],
    scoring: { values: { A: 1 }, aceAlt: 11, bustOver: 21 },
    expectedTotal: 25,
    expectedBusted: true,
    expectedSoft: false,
  },
  {
    id: "bj-soft-17",
    description: "Soft 17: Ace + 6",
    ranks: ["A", "6"],
    scoring: { values: { A: 1 }, aceAlt: 11, bustOver: 21 },
    expectedTotal: 17,
    expectedBusted: false,
    expectedSoft: true,
  },
  {
    id: "bj-double-ace",
    description: "Two aces: one soft, one hard = 12",
    ranks: ["A", "A"],
    scoring: { values: { A: 1 }, aceAlt: 11, bustOver: 21 },
    expectedTotal: 12,
    expectedBusted: false,
    expectedSoft: true,
  },
];
