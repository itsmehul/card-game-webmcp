import type { CreateGameOptions, GameSession, LegalAction } from "../types";
import { createSession, narrate } from "../engine";

const PREFLOP_ACTIONS: LegalAction[] = [
  {
    id: "check",
    label: "Check",
    chipAction: "check",
    primitive: "check",
    rotateTurn: true,
    narration: "You checked.",
  },
  {
    id: "bet",
    label: "Bet 50",
    chipAction: "bet",
    amount: 50,
    primitive: "bet",
    rotateTurn: true,
    narration: "You bet 50.",
  },
  {
    id: "fold",
    label: "Fold",
    chipAction: "fold",
    primitive: "fold",
    rotateTurn: true,
    narration: "You folded.",
  },
];

export function createTexasHoldem(
  options: Partial<CreateGameOptions> = {},
): GameSession {
  const session = createSession({
    name: options.name ?? "Texas Hold'em",
    botCount: options.botCount ?? 2,
    jokers: false,
    mode: options.mode ?? "practice",
    turnDirection: options.turnDirection ?? "clockwise",
    chips: options.chips !== false,
    startingStack: options.startingStack ?? 1000,
    enabledZones: {
      stock: true,
      hand: true,
      play: true,
      discard: true,
      capture: false,
      ...options.enabledZones,
    },
    phase: options.phase ?? "waiting_to_deal",
    legalActions: options.legalActions ?? [
      {
        id: "deal",
        label: "Deal hole cards",
        primitive: "deal_all",
        count: 2,
        visibility: "hidden",
        nextPhase: "preflop",
        nextActions: PREFLOP_ACTIONS,
        narration: "Hole cards dealt. Your action.",
      },
    ],
  });

  return narrate(
    session,
    "Texas Hold'em ready. Ask the agent to deal, or deal hole cards in practice mode.",
  );
}
