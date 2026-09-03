"use client";

import { useWebMCP, useWebMCPResource } from "@mcp-b/react-webmcp";
import {
  gameStore,
  useGameSession,
  listPresetIds,
  listPresets,
  type DealSpec,
  type HandScoring,
  type LegalAction,
  type SweepSpec,
  type TransferSpec,
  type Visibility,
  type ZoneKind,
} from "@/lib/game";

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
} as const;

const PRESET_IDS = listPresetIds() as [string, ...string[]];

const VISIBILITY = {
  type: "string",
  enum: ["hidden", "public", "unknown"],
} as const;

const ZONE = {
  type: "string",
  enum: ["stock", "hand", "play", "discard", "capture"],
} as const;

const SEAT_TARGET = {
  type: "string",
  description:
    "Player id (human, bot_1, ...) or a symbolic seat: each, others, current, winner (highest card in the play area).",
} as const;

const SCORING = {
  type: "object",
  description:
    "Configurable hand scoring. values maps ranks to points (default: pips, faces 10, ace 1); aceAlt upgrades aces while under bustOver (Blackjack: aceAlt 11, bustOver 21).",
  properties: {
    values: { type: "object" },
    aceAlt: { type: "number" },
    bustOver: { type: "number" },
    zone: ZONE,
  },
} as const;

const CONDITION = {
  type: "object",
  description:
    "Predicate evaluated against live state. subject picks what to measure, op/value compare it.",
  properties: {
    subject: {
      type: "string",
      enum: [
        "always",
        "hand_count",
        "hand_score",
        "hand_busted",
        "stock_count",
        "capture_count",
        "zone_count",
        "chips",
      ],
    },
    playerId: SEAT_TARGET,
    zone: ZONE,
    op: {
      type: "string",
      enum: ["lt", "lte", "eq", "neq", "gte", "gt"],
    },
    value: { type: "number" },
    scoring: SCORING,
  },
  required: ["subject"],
} as const;

const DEAL_SPEC = {
  type: "object",
  description:
    "One deal line. target 'play' deals to the community area; 'each' deals to every active seat.",
  properties: {
    target: SEAT_TARGET,
    count: { type: "number" },
    visibility: VISIBILITY,
  },
  required: ["target", "count"],
} as const;

const TRANSFER_SPEC = {
  type: "object",
  description:
    "Move cards between seats. Set rank to take every card of that rank (the Go Fish ask), cardIds for explicit cards, or count for the top N.",
  properties: {
    from: SEAT_TARGET,
    to: SEAT_TARGET,
    fromZone: ZONE,
    toZone: ZONE,
    rank: { type: "string" },
    rankFromSelection: {
      type: "boolean",
      description:
        "Ask for the rank of the card the human selected instead of a fixed rank (pair with requiresCardSelection)",
    },
    cardIds: { type: "array", items: { type: "string" } },
    count: { type: "number" },
    visibility: VISIBILITY,
    allowEmpty: {
      type: "boolean",
      description: "Return unchanged instead of erroring when nothing matches",
    },
  },
  required: ["from", "to"],
} as const;

const SWEEP_SPEC = {
  type: "object",
  description:
    "Award every card in a zone to a seat. to 'winner' resolves the highest card in the play area.",
  properties: {
    fromZone: ZONE,
    to: SEAT_TARGET,
    toZone: ZONE,
    visibility: VISIBILITY,
  },
  required: ["to"],
} as const;

const ACTION_PRIMITIVES = [
  "draw",
  "deal_all",
  "deal_spec",
  "play",
  "play_all",
  "discard",
  "capture",
  "transfer",
  "sweep",
  "collect_sets",
  "pass",
  "fold",
  "check",
  "call",
  "bet",
  "raise",
  "all_in",
] as const;

/** Shared schema for agent-defined human controls (buttons + optional amount). */
const LEGAL_ACTION_ITEM = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Stable id (e.g. hit, stand, fold, deal)",
    },
    label: {
      type: "string",
      description: "Button label shown to the human",
    },
    primitive: {
      type: "string",
      enum: ACTION_PRIMITIVES,
      description:
        "See skills://card-table/SKILL.md and reference.md for which primitive to use",
    },
    chipAction: {
      type: "string",
      enum: ["fold", "check", "call", "bet", "raise"],
      description: "Alias for betting primitives",
    },
    amount: {
      type: "number",
      description: "Fixed bet/raise amount when not prompting",
    },
    promptAmount: {
      type: "boolean",
      description: "If true, show a number input for the human to enter amount",
    },
    minAmount: { type: "number" },
    maxAmount: { type: "number" },
    count: {
      type: "number",
      description: "Cards to draw/deal_all (default 1)",
    },
    visibility: {
      type: "string",
      enum: ["hidden", "public", "unknown"],
    },
    requiresCardSelection: {
      type: "boolean",
      description: "Require the human to select a hand card first",
    },
    nextPhase: {
      type: "string",
      description: "Phase label to set after the click",
    },
    nextActions: {
      type: "array",
      description:
        "Replace human controls after this click. Pass [] to clear. Omit to leave unchanged.",
      items: { type: "object" },
    },
    rotateTurn: {
      type: "boolean",
      description: "Pass the turn after the click",
    },
    turnTarget: {
      type: "string",
      description:
        "Give the turn to a specific seat instead of rotating: next, previous, same (extra turn), first, or a player id. Wins over rotateTurn.",
    },
    narration: {
      type: "string",
      description: "Narration line written when the human clicks",
    },
    dealSpec: {
      type: "array",
      description:
        "Per-seat deal lines for deal_spec. Examples in skills://card-table/reference.md",
      items: DEAL_SPEC,
    },
    transfer: TRANSFER_SPEC,
    sweep: SWEEP_SPEC,
    setSize: {
      type: "number",
      description: "Cards per set for collect_sets (2 = pairs, 4 = books)",
    },
    scoring: SCORING,
    branches: {
      type: "array",
      description:
        "Ordered conditional follow-ups; first match wins. See skills://card-table/reference.md",
      items: {
        type: "object",
        properties: {
          when: CONDITION,
          nextPhase: { type: "string" },
          nextActions: { type: "array", items: { type: "object" } },
          narration: { type: "string" },
          rotateTurn: { type: "boolean" },
          turnTarget: { type: "string" },
        },
        required: ["when"],
      },
    },
  },
  required: ["id", "label"],
} as const;

function ok(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Return a descriptive error with a recovery hint so the agent can
 * self-correct and retry with valid parameters (WebMCP best practice:
 * "validate strictly in code … add descriptive errors to allow the
 * model to self-correct").
 */
function fail(error: unknown, hint?: string) {
  const message = error instanceof Error ? error.message : String(error);
  const text = hint ? `Error: ${message}\nHint: ${hint}` : `Error: ${message}`;
  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}

function asLegalActions(raw: unknown): LegalAction[] {
  if (!Array.isArray(raw)) return [];
  return raw as LegalAction[];
}

/**
 * The human seat is always button-driven: the human clicks the on-screen
 * legalActions buttons in both tutorial and practice mode, and agents must
 * never perform the human's actions. Guard every voluntary move tool so a
 * misrouted call fails loudly with a recovery hint instead of silently
 * playing for the human.
 */
const HUMAN_SEAT_ERROR =
  "The human plays their own cards via the on-screen buttons in both tutorial and practice mode. To teach in tutorial, highlight the action (highlight) and narrate what to do (narrate) — do not move the human seat.";

function assertNotHumanSeat(playerId: unknown): string {
  const id = String(playerId);
  if (id === "human") {
    throw new Error(HUMAN_SEAT_ERROR);
  }
  return id;
}

/**
 * Discovery & setup tools — always registered so the agent can browse
 * presets and create a game even when no session is active.
 *
 * WebMCP best practice: "Register tools when they're useful … then
 * unregister when the tool is no longer usable."
 */
function DiscoveryTools() {
  useWebMCP({
    name: "list_presets",
    description:
      "List every catalog preset with its id, display name, and one-line summary. Call this before inventing a custom game to avoid duplicating a built-in. Returns an array of preset objects.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false, untrustedContentHint: false },
    execute: async () => {
      try {
        return ok({ presets: listPresets() });
      } catch (e) {
        return fail(e, "Ensure the card-table page is loaded.");
      }
    },
  });

  useWebMCP({
    name: "create_game",
    description:
      "Create a new card-game session and reset the table. For a catalog game, pass preset (e.g. texas-holdem, blackjack, war, go-fish); name is optional. For a custom game, omit preset and pass name, zones, legalActions, and instructions. Practice mode requires legalActions so the human has buttons to click.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Display name. Required for custom games; optional when preset is set.",
        },
        preset: {
          type: "string",
          enum: PRESET_IDS,
          description:
            "Optional built-in catalog preset. Omit to invent a custom game.",
        },
        botCount: {
          type: "number",
          description: "Number of bot opponents (1-5)",
        },
        jokers: {
          type: "boolean",
          description: "Include 2 jokers in the deck",
        },
        mode: {
          type: "string",
          enum: ["tutorial", "practice"],
          description:
            "tutorial: the agent teaches by highlighting the human's next action and narrating what to do — it must NOT perform the human's actions (the human clicks the on-screen buttons). practice: the human plays via legalActions controls with no agent narration. In both modes the human seat is button-driven; agents only move bot seats.",
        },
        turnDirection: {
          type: "string",
          enum: ["clockwise", "counterclockwise"],
        },
        chips: {
          type: "boolean",
          description: "Enable chip ledger (default true for holdem)",
        },
        startingStack: { type: "number" },
        phase: {
          type: "string",
          description: "Starting phase label (default waiting_to_deal)",
        },
        enabledZones: {
          type: "object",
          properties: {
            stock: { type: "boolean" },
            hand: { type: "boolean" },
            play: { type: "boolean" },
            discard: { type: "boolean" },
            capture: { type: "boolean" },
          },
        },
        playLayout: {
          type: "string",
          enum: ["spread", "stack"],
          description: "How to present shared play cards. Use stack for one face-down pile, such as Bullshit.",
        },
        legalActions: {
          type: "array",
          description:
            "Practice-mode human buttons. See skills://card-table/reference.md",
          items: LEGAL_ACTION_ITEM,
        },
        instructions: {
          type: "string",
          description:
            "Student-facing how-to for the How to play sidebar. Replace anytime with set_instructions.",
        },
      },
    } as const,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        const session = gameStore.createGame({
          name:
            args?.name !== undefined ? String(args.name) : undefined,
          preset: args?.preset as string | undefined,
          botCount: args?.botCount as number | undefined,
          jokers: args?.jokers as boolean | undefined,
          mode: args?.mode as "tutorial" | "practice" | undefined,
          turnDirection: args?.turnDirection as
            | "clockwise"
            | "counterclockwise"
            | undefined,
          chips: args?.chips as boolean | undefined,
          startingStack: args?.startingStack as number | undefined,
          phase: args?.phase as string | undefined,
          enabledZones: args?.enabledZones as
            | {
                stock?: boolean;
                hand?: boolean;
                play?: boolean;
                discard?: boolean;
                capture?: boolean;
              }
            | undefined,
          playLayout: args?.playLayout as "spread" | "stack" | undefined,
          legalActions:
            args?.legalActions !== undefined
              ? asLegalActions(args.legalActions)
              : undefined,
          instructions:
            args?.instructions !== undefined
              ? String(args.instructions)
              : undefined,
        });
        return ok({
          message: `Created ${session.name}`,
          hint:
            session.mode === "practice" && session.legalActions.length === 0
              ? "No human controls yet. Call set_legal_actions (or recreate with legalActions) before the human's turn."
              : undefined,
          state: gameStore.getStatePayload(),
        });
      } catch (e) {
        return fail(e, "For catalog games pass a valid preset id from list_presets. For custom games pass name and legalActions.");
      }
    },
  });

  return null;
}

/**
 * Game-session tools — only registered while a game session is active.
 * Unregistered when the session ends, so the agent's tool list stays
 * clean and unambiguous (WebMCP best practice: manage tool registration).
 */
function GameSessionTools() {
  useWebMCP({
    name: "get_game_state",
    description:
      "Read the compact agent state: seats, chips, pots, legalActions, in-play cards (not stock), stockCount, and the last 3 narration lines. Every mutating tool already returns this same payload — only call get_game_state when that prior result was lost.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false, untrustedContentHint: true },
    execute: async () => {
      try {
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e, "Call create_game first to start a session.");
      }
    },
  });

  useWebMCP({
    name: "shuffle",
    description:
      "Collect every card back into the stock pile, shuffle the deck, and unfold all seats. Use this to reset entropy between hands or rounds.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    execute: async () => {
      try {
        gameStore.shuffle();
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e, "A game session must be active. Call create_game first.");
      }
    },
  });

  useWebMCP({
    name: "deal",
    description:
      "Deal a number of cards from the stock into a player's hand. Pass playerId 'play' to deal face-up community or tableau cards instead.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: {
          type: "string",
          description: "Player id, or 'play' to deal to the play area",
        },
        count: { type: "number", description: "Number of cards" },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
          description: "hidden=private to owner, public=face up, unknown=face down to all",
        },
      },
      required: ["playerId", "count"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        const playerId = String(args?.playerId);
        const count = Number(args?.count);
        const visibility = args?.visibility as
          | "hidden"
          | "public"
          | "unknown"
          | undefined;
        if (playerId === "play") {
          gameStore.dealToPlay(count, visibility ?? "public");
        } else {
          gameStore.deal(playerId, count, visibility ?? "hidden");
        }
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e, "Check that the playerId matches a seat id (human, bot_1, …) or 'play', and that enough cards remain in the stock.");
      }
    },
  });

  useWebMCP({
    name: "draw",
    description: "Draw one or more cards from the stock into a BOT seat's hand (e.g. a bot's hit or Go Fish draw). The human seat is always rejected — the human draws via the on-screen buttons. Defaults to 1 card with hidden visibility.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        count: { type: "number" },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
        },
      },
      required: ["playerId"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.draw(
          assertNotHumanSeat(args?.playerId),
          Number(args?.count ?? 1),
          args?.visibility as "hidden" | "public" | "unknown" | undefined,
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "play",
    description: "Move one or more cards from a BOT seat's hand into the shared play area face-up. The human seat is always rejected — the human plays via the on-screen buttons.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        cardIds: {
          type: "array",
          items: { type: "string" },
        },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
        },
      },
      required: ["playerId", "cardIds"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.play(
          assertNotHumanSeat(args?.playerId),
          (args?.cardIds as string[]) ?? [],
          args?.visibility as "hidden" | "public" | "unknown" | undefined,
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "discard",
    description: "Move one or more cards from a BOT seat's hand to the shared discard pile. The human seat is always rejected — the human discards via the on-screen buttons.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        cardIds: {
          type: "array",
          items: { type: "string" },
        },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
        },
      },
      required: ["playerId", "cardIds"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.discard(
          assertNotHumanSeat(args?.playerId),
          (args?.cardIds as string[]) ?? [],
          args?.visibility as "hidden" | "public" | "unknown" | undefined,
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "capture",
    description: "Move one or more cards into a BOT seat's capture (score) pile, typically after the bot wins a trick or completes a set. The human seat is always rejected — the human captures via the on-screen buttons.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        cardIds: {
          type: "array",
          items: { type: "string" },
        },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
        },
      },
      required: ["playerId", "cardIds"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.capture(
          assertNotHumanSeat(args?.playerId),
          (args?.cardIds as string[]) ?? [],
          args?.visibility as "hidden" | "public" | "unknown" | undefined,
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "reveal",
    description: "Change the visibility of one or more cards, such as flipping hole cards face-up or turning over a flop. Defaults to public visibility.",
    inputSchema: {
      type: "object",
      properties: {
        cardIds: {
          type: "array",
          items: { type: "string" },
        },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
        },
      },
      required: ["cardIds"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.reveal(
          (args?.cardIds as string[]) ?? [],
          (args?.visibility as "hidden" | "public" | "unknown" | undefined) ??
            "public",
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "rotate_turn",
    description: "Advance the active turn to the next non-folded player in the current turn direction. For targeted turn changes, use set_turn instead.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async () => {
      try {
        gameStore.rotateTurn();
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "set_phase",
    description:
      "Set the current phase label (e.g. preflop, flop, turn, river, showdown, player_hit).",
    inputSchema: {
      type: "object",
      properties: {
        phase: { type: "string" },
      },
      required: ["phase"],
    } as const,
    annotations: { readOnlyHint: false, idempotentHint: true },
    execute: async (args) => {
      try {
        gameStore.setPhase(String(args?.phase));
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "set_legal_actions",
    description:
      "Replace practice-mode human buttons. Call when the legal decision changes. Field notes: skills://card-table/reference.md",
    inputSchema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          items: LEGAL_ACTION_ITEM,
        },
      },
      required: ["actions"],
    } as const,
    annotations: { readOnlyHint: false, idempotentHint: true },
    execute: async (args) => {
      try {
        gameStore.setLegalActions(asLegalActions(args?.actions));
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "chip_action",
    description:
      "Apply a betting action for a BOT seat. Fold removes them from the hand; check passes when no bet is owed; call matches the current bet; bet and raise require a positive amount. The human seat is always rejected — the human bets via the on-screen buttons.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        action: {
          type: "string",
          enum: ["fold", "check", "call", "bet", "raise"],
        },
        amount: {
          type: "number",
          description: "Required for bet/raise",
        },
      },
      required: ["playerId", "action"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.chipAction(
          assertNotHumanSeat(args?.playerId),
          args?.action as "fold" | "check" | "call" | "bet" | "raise",
          Number(args?.amount ?? 0),
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "apply_move",
    description:
      "Apply a primitive move for a BOT seat only. The human seat is always rejected — the human plays via the on-screen legalActions buttons in both tutorial and practice mode. In tutorial, teach with highlight + narrate instead of moving for the human. Prefer the named tool (draw, play, transfer_cards) over apply_move when one exists.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        primitive: {
          type: "string",
          enum: [
            "draw",
            "deal_all",
            "play",
            "play_all",
            "discard",
            "capture",
            "collect_sets",
            "reveal",
            "pass",
            "fold",
            "check",
            "call",
            "bet",
            "raise",
            "all_in",
          ],
        },
        cardIds: {
          type: "array",
          items: { type: "string" },
        },
        count: { type: "number" },
        amount: { type: "number" },
        setSize: {
          type: "number",
          description: "Cards per set for collect_sets (default 4)",
        },
        visibility: VISIBILITY,
      },
      required: ["playerId", "primitive"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.applyMove({
          playerId: String(args?.playerId),
          primitive: args?.primitive as
            | "draw"
            | "deal_all"
            | "play"
            | "play_all"
            | "discard"
            | "capture"
            | "collect_sets"
            | "reveal"
            | "pass"
            | "fold"
            | "check"
            | "call"
            | "bet"
            | "raise"
            | "all_in",
          cardIds: args?.cardIds as string[] | undefined,
          count: args?.count as number | undefined,
          amount: args?.amount as number | undefined,
          setSize: args?.setSize as number | undefined,
          visibility: args?.visibility as Visibility | undefined,
          fromAgent: true,
        });
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "deal_batch",
    description:
      "Deal multiple lines in one step, giving different seats different counts and visibilities. Useful for Blackjack (dealer up-card beside face-down hole cards) or any uneven opening deal. Use target 'play' for community cards and 'each' for every active seat.",
    inputSchema: {
      type: "object",
      properties: {
        specs: { type: "array", items: DEAL_SPEC },
      },
      required: ["specs"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.dealBatch((args?.specs ?? []) as DealSpec[]);
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "transfer_cards",
    description:
      "Move cards between two seats. Set rank to take every card of that rank (the Go Fish ask), cardIds for explicit cards, or count for the top N from the source. When nothing matches and allowEmpty is false, the tool returns an error — that error is the 'go fish' signal to draw from stock instead. The source seat must never be the human — taking the human's cards is their decision, made via the on-screen buttons.",
    inputSchema: TRANSFER_SPEC,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        const spec = args as unknown as TransferSpec;
        if (spec.from === "human") {
          throw new Error(HUMAN_SEAT_ERROR);
        }
        gameStore.transfer(spec);
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "play_all",
    description:
      "Every active (non-folded) seat simultaneously plays cards from hand into the play area. Used for games like War where all players flip at once instead of taking turns. Always rejected for agent use: a simultaneous flip includes the human's cards, and the human's flip is driven by their on-screen button (the legalActions play_all primitive) — in tutorial, highlight the flip button and narrate instead.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Cards per seat (default 1)" },
        visibility: VISIBILITY,
      },
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async () => {
      return fail(
        new Error(
          `play_all moves every seat including the human. ${HUMAN_SEAT_ERROR} Simultaneous flips (e.g. War) are started by the human's Flip button.`,
        ),
      );
    },
  });

  useWebMCP({
    name: "sweep_zone",
    description:
      "Award every card in a zone to one seat. Pass to as 'winner' to automatically resolve the highest card in the play area; a tie returns an error so you can run a tiebreaker (e.g. War). Commonly used after compare_zone.",
    inputSchema: SWEEP_SPEC,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.sweepZone(args as unknown as SweepSpec);
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "compare_zone",
    description:
      "Read each seat's highest card in a zone and determine who is winning. Returns a winners array (more than one entry means a tie). Call before sweep_zone so you can narrate the outcome.",
    inputSchema: {
      type: "object",
      properties: { zone: ZONE },
    } as const,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: async (args) => {
      try {
        return ok(gameStore.compareZone(args?.zone as ZoneKind | undefined));
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "collect_sets",
    description:
      "Move every complete same-rank set from a BOT seat's hand into their capture pile. Use size 4 for Go Fish books or size 2 for pairs. Returns the collected sets so you can narrate which ranks were completed. The human seat is always rejected — the human banks sets via the on-screen buttons.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        size: {
          type: "number",
          description: "Cards per set (default 4)",
        },
      },
      required: ["playerId"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        const { sets } = gameStore.collectSets(
          assertNotHumanSeat(args?.playerId),
          Number(args?.size ?? 4),
        );
        return ok({ sets, state: gameStore.getStatePayload() });
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "score_hand",
    description:
      "Calculate a seat's hand total with configurable rank values. For Blackjack, pass scoring {aceAlt: 11, bustOver: 21} to get total, soft flag, and busted flag. Omit scoring for plain pip-value totals.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        scoring: SCORING,
      },
      required: ["playerId"],
    } as const,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: async (args) => {
      try {
        return ok(
          gameStore.scoreHand(
            String(args?.playerId),
            args?.scoring as HandScoring | undefined,
          ),
        );
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "set_turn",
    description:
      "Give the active turn to a specific seat by id, or use a symbolic target: next, previous, same (grants an extra turn), or first. Use this for dealer-after-player sequences or repeated turns that plain rotation cannot express.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description: "Player id, or next / previous / same / first",
        },
      },
      required: ["target"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.moveTurn(String(args?.target));
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "post_blinds",
    description:
      "Post forced bets (small blind, big blind) before the deal begins. Each entry caps at that seat's remaining stack, so a short-stacked seat goes all-in automatically.",
    inputSchema: {
      type: "object",
      properties: {
        blinds: {
          type: "array",
          items: {
            type: "object",
            properties: {
              playerId: { type: "string" },
              amount: { type: "number" },
            },
            required: ["playerId", "amount"],
          },
        },
      },
      required: ["blinds"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.postBlinds(
          (args?.blinds ?? []) as Array<{ playerId: string; amount: number }>,
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "get_pots",
    description:
      "Split the pot into main and side pots based on each seat's committed chips this hand. Returns eligible seats for each pot layer. Folded seats still fund the layers they paid into but are not eligible to win.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: async () => {
      try {
        return ok({ pots: gameStore.computePots() });
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "award_pot",
    description:
      "Pay a pot to one or more winners, splitting the chips evenly (odd chips go to the first winner). Pass amount to settle a specific side pot from get_pots; omit amount to award the entire pot.",
    inputSchema: {
      type: "object",
      properties: {
        winnerIds: { type: "array", items: { type: "string" } },
        amount: { type: "number" },
      },
      required: ["winnerIds"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.awardPot(
          (args?.winnerIds ?? []) as string[],
          args?.amount as number | undefined,
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "award_chips",
    description:
      "Adjust a seat's chip stack directly by a positive or negative amount, bypassing the pot. Use for Blackjack wager settlement, bonuses, or penalties.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        amount: { type: "number" },
      },
      required: ["playerId", "amount"],
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        gameStore.awardChips(String(args?.playerId), Number(args?.amount ?? 0));
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "reset_round",
    description:
      "Clear betting bookkeeping between streets or hands. Scope 'betting' clears the current round's contributions and resets the current bet (use between streets like flop → turn). Scope 'hand' also clears per-hand commitments and unfolds every seat (use when starting a new hand).",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["betting", "hand"] },
      },
    } as const,
    annotations: { readOnlyHint: false, destructiveHint: true },
    execute: async (args) => {
      try {
        if (args?.scope === "hand") {
          gameStore.resetHand();
        } else {
          gameStore.resetBettingRound();
        }
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "set_instructions",
    description:
      "Replace the student-facing How to Play sidebar text. Write the game's rules, goal, and what the human should do on their current turn. Call again whenever the game phase or available decisions change.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    } as const,
    annotations: { readOnlyHint: false, idempotentHint: true, untrustedContentHint: true },
    execute: async (args) => {
      try {
        gameStore.setInstructions(String(args?.text ?? ""));
        return ok({ instructions: gameStore.getSnapshot()?.instructions ?? "" });
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "highlight",
    description:
      "Visually highlight a UI element with a glowing border so the student knows where to look or click. Only available in tutorial mode. Call with no arguments (or target null) to clear the highlight.",
    inputSchema: {
      type: "object",
      properties: {
        target: {
          type: "string",
          description:
            "Which element to highlight. Use a zone id ('stock', 'hand', 'play', 'discard', 'capture', 'actions', 'pot') or a player id ('human', 'bot_1', …) to highlight that player's entire seat. For zone targets, pair with playerId to scope to a specific seat (e.g. target 'hand' + playerId 'human'). Omit or pass null to clear.",
        },
        playerId: {
          type: "string",
          description:
            "Optional player scope for zone targets — e.g. highlight bot_1's hand rather than the human's. Defaults to human for hand/capture.",
        },
        label: {
          type: "string",
          description: "Optional short label shown near the highlighted element (e.g. 'Click here', 'Your hand').",
        },
      },
    } as const,
    annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    execute: async (args) => {
      try {
        if (!args?.target) {
          gameStore.setHighlight(null);
          return ok({ highlight: null });
        }
        const highlight = {
          target: String(args.target),
          playerId: args.playerId ? String(args.playerId) : undefined,
          label: args.label ? String(args.label) : undefined,
        };
        gameStore.setHighlight(highlight);
        return ok({ highlight });
      } catch (e) {
        return fail(e, "A game session must be active. Call create_game first.");
      }
    },
  });

  useWebMCP({
    name: "narrate",
    description:
      "Append a short, educational explanation to the narration log visible to the student. Keep entries concise — one or two sentences describing what just happened and why.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    } as const,
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (args) => {
      try {
        gameStore.narrate(String(args?.text ?? ""));
        return ok({ narration: gameStore.getSnapshot()?.narration ?? [] });
      } catch (e) {
        return fail(e);
      }
    },
  });

  return null;
}

/**
 * Tutorial-only tool: blocks until the human clicks a legalAction button on
 * the table, then returns what they did. Lets the agent proceed to the next
 * tutorial step without the user having to type "done". The card table stays
 * the single source of truth — the await resolves from the store's
 * applyHumanLegalAction, not from a client-side elicitation form.
 */
function TutorialAwaitTool() {
  useWebMCP({
    name: "await_user_action",
    description:
      "Block until the human clicks a legalAction button on the table, then return what they did. Tutorial-only. Pass expectActionId to wait for a specific recommended action; if the human clicks a different action the result has matched:false so you can re-narrate and re-highlight. Always call highlight + narrate + set_legal_actions first so the student knows what to click. Resolves with { timedOut: true } after timeoutMs; rejects if the game ends while waiting.",
    inputSchema: {
      type: "object",
      properties: {
        expectActionId: {
          type: "string",
          description:
            "Action id to wait for (e.g. 'hit'). Omit to accept the next action of any kind.",
        },
        timeoutMs: {
          type: "number",
          description:
            "Optional max wait in milliseconds. On expiry resolves with { timedOut: true } instead of erroring.",
        },
      },
    } as const,
    annotations: { readOnlyHint: true, openWorldHint: false },
    execute: async (args) => {
      try {
        const result = await gameStore.awaitUserAction({
          expectActionId: args?.expectActionId
            ? String(args.expectActionId)
            : undefined,
          timeoutMs: args?.timeoutMs ? Number(args.timeoutMs) : undefined,
        });
        if (result.timedOut) {
          return ok(result);
        }
        gameStore.ackUserAction();
        return ok(result);
      } catch (e) {
        return fail(
          e,
          "Game ended while waiting. Recreate the session and re-teach the step.",
        );
      }
    },
  });

  return null;
}

/**
 * Resources — always registered so agents can read the playbook and
 * reference even before a game starts.
 */
function SkillResources() {
  useWebMCPResource({
    uri: "skills://card-table/SKILL.md",
    name: "Card Table Skill",
    description:
      "Playbook for card-table WebMCP tools: which tool to call, when, and catalog follow-through recipes.",
    mimeType: "text/markdown",
    read: async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await fetch("/skills/card-table/SKILL.md").then((r) =>
            r.text(),
          ),
        },
      ],
    }),
  });

  useWebMCPResource({
    uri: "skills://card-table/reference.md",
    name: "Card Table Reference",
    description:
      "legalActions schema, primitives, branches, and create_game / set_legal_actions examples for custom games.",
    mimeType: "text/markdown",
    read: async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: await fetch("/skills/card-table/reference.md").then((r) =>
            r.text(),
          ),
        },
      ],
    }),
  });

  return null;
}

/**
 * Registers card-table tools with document.modelContext.
 * Mount once inside the client table shell.
 *
 * Follows WebMCP best practices:
 * - Discovery tools (list_presets, create_game) are always registered.
 * - Game-session tools are registered only when a session exists and
 *   unregistered when it ends, keeping the agent's tool list clean.
 * - Skill resources are always available for reference.
 */
export function WebMCPTools() {
  const session = useGameSession();

  return (
    <>
      <DiscoveryTools />
      {session && <GameSessionTools />}
      {session?.mode === "tutorial" && <TutorialAwaitTool />}
      <SkillResources />
    </>
  );
}
