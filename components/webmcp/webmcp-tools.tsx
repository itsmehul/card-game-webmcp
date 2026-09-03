"use client";

import { useWebMCP } from "usewebmcp";
import { gameStore, type LegalAction } from "@/lib/game";

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
} as const;

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
      enum: [
        "draw",
        "deal_all",
        "play",
        "discard",
        "capture",
        "pass",
        "fold",
        "check",
        "call",
        "bet",
        "raise",
      ],
      description:
        "draw=hit one card; deal_all=deal count to every seat; play/discard/capture need a selected card; pass=no card/chip move (Stand); chip primitives for betting",
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
    narration: {
      type: "string",
      description: "Narration line written when the human clicks",
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

function fail(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}

function asLegalActions(raw: unknown): LegalAction[] {
  if (!Array.isArray(raw)) return [];
  return raw as LegalAction[];
}

/**
 * Registers all card-table tools with document.modelContext.
 * Mount once inside the client table shell.
 */
export function WebMCPTools() {
  useWebMCP({
    name: "create_game",
    description: [
      "Create a new card game session and define the human controls for practice mode.",
      "IMPORTANT — when creating any game the human will play:",
      "1) Pass legalActions with the buttons the human needs at the first decision (e.g. Blackjack: Hit+Stand; Hold'em: Deal hole cards; War: Flip).",
      "2) Each action needs id, label, and a primitive (draw|deal_all|play|discard|capture|pass|fold|check|call|bet|raise).",
      "3) Use nextPhase / nextActions / rotateTurn / narration on each control so the UI advances without hard-coded game rules.",
      "4) After later deals or bot moves, call set_legal_actions again to refresh the control set for the current decision.",
      "5) Call set_instructions (or pass instructions on create_game) with student-facing how-to text for the How to play sidebar.",
      "Use preset 'texas-holdem' for the default poker table (seeds Deal → Check/Bet/Fold), or pass custom name/zones/jokers/mode/legalActions for any card game. Resets the table.",
    ].join(" "),
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Game display name" },
        preset: {
          type: "string",
          enum: ["texas-holdem"],
          description: "Optional built-in preset",
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
            "tutorial: agent may move for the human; practice: human plays via legalActions controls",
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
        legalActions: {
          type: "array",
          description:
            "Human input controls for practice mode. Define these for the game you create — they become the buttons the student clicks. Example Blackjack: [{id:'hit',label:'Hit',primitive:'draw'},{id:'stand',label:'Stand',primitive:'pass',nextPhase:'dealer_act',nextActions:[]}]. Example deal-then-bet: [{id:'deal',label:'Deal',primitive:'deal_all',count:2,nextPhase:'preflop',nextActions:[{id:'check',label:'Check',primitive:'check',rotateTurn:true},{id:'bet',label:'Bet 50',primitive:'bet',amount:50,rotateTurn:true},{id:'fold',label:'Fold',primitive:'fold',rotateTurn:true}]}].",
          items: LEGAL_ACTION_ITEM,
        },
        instructions: {
          type: "string",
          description:
            "Student-facing how-to for the How to play sidebar. Replace anytime with set_instructions.",
        },
      },
      required: ["name"],
    } as const,
    execute: async (args) => {
      try {
        const session = gameStore.createGame({
          name: String(args?.name ?? "Card Game"),
          preset: args?.preset as "texas-holdem" | undefined,
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
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "get_game_state",
    description:
      "Return the full game state: omniscient view (all cards for bot play) and humanView (what the student sees). Call this before deciding bot moves.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true },
    execute: async () => {
      try {
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "shuffle",
    description:
      "Shuffle all cards back into the stock pile and clear folds. Resets entropy for a new round.",
    inputSchema: EMPTY_SCHEMA,
    execute: async () => {
      try {
        gameStore.shuffle();
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "deal",
    description:
      "Deal count cards from stock into a player's hand (or use target 'play' for community/tableau cards).",
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
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "draw",
    description: "Draw one or more cards from stock into a player's hand.",
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
    execute: async (args) => {
      try {
        gameStore.draw(
          String(args?.playerId),
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
    description: "Move card(s) from a player's hand into the play area.",
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
    execute: async (args) => {
      try {
        gameStore.play(
          String(args?.playerId),
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
    description: "Send card(s) from a player's hand to the discard pile.",
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
    execute: async (args) => {
      try {
        gameStore.discard(
          String(args?.playerId),
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
    description: "Move card(s) into a player's capture/score pile.",
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
    execute: async (args) => {
      try {
        gameStore.capture(
          String(args?.playerId),
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
    description: "Change visibility of card(s) (e.g. flip hole cards or flop).",
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
    description: "Pass the active turn to the next non-folded player.",
    inputSchema: EMPTY_SCHEMA,
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
    description: [
      "Replace the human input controls shown in practice mode.",
      "Call this whenever the legal decisions change (new street, after a hit, after bots act).",
      "Each action needs id, label, and a primitive so the UI can run it without game-specific code.",
      "Use nextPhase/nextActions/rotateTurn/narration to chain the next decision.",
      "Examples: Hit/Stand; Check/Call/Raise/Fold; Play selected card; Deal to all seats.",
    ].join(" "),
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
      "Apply a betting action for a player: fold, check, call, bet, or raise.",
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
    execute: async (args) => {
      try {
        gameStore.chipAction(
          String(args?.playerId),
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
      "Apply a primitive move for a seat. In practice mode, rejected for the human (they must click). In tutorial mode, allowed for any seat including the human.",
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
            "discard",
            "capture",
            "reveal",
            "pass",
            "fold",
            "check",
            "call",
            "bet",
            "raise",
          ],
        },
        cardIds: {
          type: "array",
          items: { type: "string" },
        },
        count: { type: "number" },
        amount: { type: "number" },
        visibility: {
          type: "string",
          enum: ["hidden", "public", "unknown"],
        },
      },
      required: ["playerId", "primitive"],
    } as const,
    execute: async (args) => {
      try {
        gameStore.applyMove({
          playerId: String(args?.playerId),
          primitive: args?.primitive as
            | "draw"
            | "deal_all"
            | "play"
            | "discard"
            | "capture"
            | "reveal"
            | "pass"
            | "fold"
            | "check"
            | "call"
            | "bet"
            | "raise",
          cardIds: args?.cardIds as string[] | undefined,
          count: args?.count as number | undefined,
          amount: args?.amount as number | undefined,
          visibility: args?.visibility as
            | "hidden"
            | "public"
            | "unknown"
            | undefined,
          fromAgent: true,
        });
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "set_instructions",
    description:
      "Replace the student-facing How to play sidebar. Write rules, goal, and what the human should do this turn. Call again when the game or decision changes.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    } as const,
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
    name: "narrate",
    description:
      "Append a short educational explanation to the narration log for the student.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string" },
      },
      required: ["text"],
    } as const,
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
