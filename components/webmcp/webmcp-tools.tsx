"use client";

import { useWebMCP, useWebMCPResource } from "@mcp-b/react-webmcp";
import {
  gameStore,
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

const SKILL_MD = `# Card Table tools

Tool schemas stay on the MCP server. This file is the playbook: **which tool, when**. Do not paste it into narration. Fetch \`skills://card-table/reference.md\` only when writing \`legalActions\` or a custom game.

Seats: \`human\`, \`bot_1\`… or \`each\` / \`others\` / \`current\` / \`winner\`. Zones: \`stock\`, \`hand\`, \`play\`, \`discard\`, \`capture\`.

## Discover tools

Host names are **suffixed** (\`list_presets_bb8b\`, not \`list_presets\`). Looking up the bare name fails.

1. \`GetDynamicTools\` on \`user-webmcp-local-relay\` with **pattern** \`list_presets\` (or \`create_game\`, \`deal\`, …).
2. Call the matching suffixed name. If two suffixes exist, use the source with the latest \`lastSeenAt\` (\`webmcp_list_sources\`).
3. Do not call \`GetDynamicTools\` with \`toolName\` set to the unsuffixed playbook name.

## Start

1. \`list_presets\` before inventing a game.
2. Catalog → \`create_game\` with \`preset\` (name optional; the preset supplies it). Custom → omit \`preset\`; pass \`name\`, zones, \`legalActions\`, \`instructions\`.
3. Practice: human clicks buttons; never \`apply_move\` for \`human\`. Tutorial: agent may move any seat.
4. Mutating tools return compact agent state (in-play cards only, \`stockCount\`, last 3 narration lines). Use that result for the next decision — do **not** call \`get_game_state\` again unless the previous payload was lost.

## Router

| Intent | Tool |
| --- | --- |
| Compact state (if mutate result lost) | \`get_game_state\` |
| Human buttons / next decision | \`set_legal_actions\` |
| Sidebar how-to | \`set_instructions\` |
| Student log | \`narrate\` (short) |
| Phase label | \`set_phase\` |
| Whose turn | \`set_turn\` (\`next\` / \`previous\` / \`same\` / \`first\` / id) or \`rotate_turn\` |
| New deck | \`shuffle\` |
| One-seat deal / community | \`deal\` (\`playerId: play\` for tableau) |
| Uneven / mixed-visibility deal | \`deal_batch\` |
| Hit / draw | \`draw\` |
| Hand → play | \`play\` |
| Simultaneous flip (War) | \`play_all\` |
| Hand → discard | \`discard\` |
| Into score pile | \`capture\` |
| Flip visibility | \`reveal\` |
| Ask for a rank (Go Fish) | \`transfer_cards\` (\`rank\` or \`rankFromSelection\`; empty + \`allowEmpty: false\` = go fish) |
| Books / pairs | \`collect_sets\` (\`size\` 4 or 2) |
| Who wins a zone | \`compare_zone\` then \`sweep_zone\` (\`to: winner\` errors on a tie) |
| Hand total | \`score_hand\` (Blackjack: \`scoring: { aceAlt: 11, bustOver: 21 }\`) |
| Forced bets | \`post_blinds\` |
| Bot bet | \`chip_action\` or \`apply_move\` chip primitive |
| Side pots | \`get_pots\` then \`award_pot\` |
| Off-pot chips | \`award_chips\` |
| Between streets / new hand | \`reset_round\` (\`betting\` vs \`hand\`) |
| Generic bot primitive | \`apply_move\` (not for \`human\` in practice) |

Prefer the named tool over \`apply_move\` when both exist (\`draw\`, \`play\`, \`transfer_cards\`, …).

## Catalog follow-through

- **Hold'em**: \`post_blinds\` → deal holes → bot \`chip_action\` → flop/turn/river via \`deal\` to \`play\` → \`reset_round\` betting → showdown \`get_pots\` / \`award_pot\`.
- **Blackjack**: after stand/bust, \`score_hand\` dealer, hit dealer to 17, \`award_chips\`.
- **War**: \`play_all\` → \`compare_zone\` → \`sweep_zone\`; on tie, more \`play_all\` then sweep.
- **Go Fish**: \`transfer_cards\` from the asked bot; on error, \`draw\` and pass turn; \`collect_sets\` size 4.

## Rules

- Do not recreate a preset that \`list_presets\` already lists.
- Refresh \`legalActions\` whenever the legal decision changes.
- Keep \`narrate\` educational and short; do not dump JSON state.`;

const REFERENCE_MD = `# legalActions and custom games

Each control needs \`id\`, \`label\`, and a \`primitive\` (or \`chipAction\`). Optional: \`nextPhase\`, \`nextActions\`, \`rotateTurn\`, \`turnTarget\`, \`narration\`, \`count\`, \`visibility\`, \`requiresCardSelection\`, \`promptAmount\`, \`dealSpec\`, \`transfer\`, \`sweep\`, \`setSize\`, \`scoring\`, \`branches\`.

Primitives: \`draw\`, \`deal_all\`, \`deal_spec\`, \`play\`, \`play_all\`, \`discard\`, \`capture\`, \`transfer\`, \`sweep\`, \`collect_sets\`, \`pass\`, \`fold\`, \`check\`, \`call\`, \`bet\`, \`raise\`, \`all_in\`.

\`turnTarget\` wins over \`rotateTurn\`: \`next\`, \`previous\`, \`same\`, \`first\`, or a player id.

\`branches\`: first matching \`when\` wins. Subjects: \`always\`, \`hand_count\`, \`hand_score\`, \`hand_busted\`, \`stock_count\`, \`capture_count\`, \`zone_count\`, \`chips\`. Compare with \`op\` + \`value\`.

Blackjack deal_spec: human 2 hidden; dealer 1 public + 1 unknown. Hit branches: \`hand_busted\` then \`hand_score\` eq 21, else \`always\`.

\`create_game\` / \`set_legal_actions\` examples:

\`\`\`json
[{"id":"hit","label":"Hit","primitive":"draw"},{"id":"stand","label":"Stand","primitive":"pass","nextPhase":"dealer_act","nextActions":[]}]
\`\`\``;

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
    name: "list_presets",
    description:
      "List catalog presets (id, name, summary). Call before inventing a custom game. Playbook: skills://card-table/SKILL.md. Discover by pattern search; the host suffixes this name.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true },
    execute: async () => {
      try {
        return ok({ presets: listPresets() });
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "create_game",
    description: [
      "Create a session. Use preset to start a catalog game; omit preset to invent one.",
      "Catalog: pass preset (texas-holdem|blackjack|war|go-fish); name is optional.",
      "Custom: pass name, zones, legalActions, instructions. Practice needs legalActions.",
      "Schema: skills://card-table/reference.md. Discover this tool by pattern search (host suffixes the name). Resets the table.",
    ].join(" "),
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
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "get_game_state",
    description:
      "Compact agent state: seats, chips, pots, legalActions, in-play cards (not stock), stockCount, last 3 narration lines. Mutating tools return the same shape — skip this call unless that result was lost. Tool routing: skills://card-table/SKILL.md",
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
      "Deal several lines at once so seats can get different counts and visibilities in one step — a Blackjack dealer up-card beside face-down hole cards, or an uneven opening. Use target 'play' for community cards and 'each' for every active seat.",
    inputSchema: {
      type: "object",
      properties: {
        specs: { type: "array", items: DEAL_SPEC },
      },
      required: ["specs"],
    } as const,
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
      "Move cards from one seat to another. Set rank to take every card of that rank (the Go Fish ask), cardIds for specific cards, or count for the top N. Errors when nothing matches unless allowEmpty is true — that error is the 'go fish' signal.",
    inputSchema: TRANSFER_SPEC,
    execute: async (args) => {
      try {
        gameStore.transfer(args as unknown as TransferSpec);
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "play_all",
    description:
      "Every active seat plays cards from hand into the play area at once — simultaneous flips like War, where turn order does not apply.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Cards per seat (default 1)" },
        visibility: VISIBILITY,
      },
    } as const,
    execute: async (args) => {
      try {
        gameStore.playAll(
          Number(args?.count ?? 1),
          (args?.visibility as Visibility | undefined) ?? "public",
        );
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e);
      }
    },
  });

  useWebMCP({
    name: "sweep_zone",
    description:
      "Award every card in a zone to a seat — the War battle winner, or a trick. Use to 'winner' to resolve the highest card in the play area automatically; it errors on a tie so you can run a war.",
    inputSchema: SWEEP_SPEC,
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
      "Read the highest card each seat has in a zone and who is winning. Returns winners (more than one means a tie). Use before sweep_zone to narrate the result.",
    inputSchema: {
      type: "object",
      properties: { zone: ZONE },
    } as const,
    annotations: { readOnlyHint: true },
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
      "Move a seat's complete same-rank sets from hand into their capture pile — Go Fish books of four, or pairs. Returns the sets that were collected.",
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
    execute: async (args) => {
      try {
        const { sets } = gameStore.collectSets(
          String(args?.playerId),
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
      "Score a seat's hand with configurable rank values instead of hard-coded rules. Blackjack: scoring {aceAlt:11, bustOver:21} returns total, soft, and busted. Omit scoring for plain pip totals.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        scoring: SCORING,
      },
      required: ["playerId"],
    } as const,
    annotations: { readOnlyHint: true },
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
      "Give the turn to a specific seat, or move it symbolically: next, previous, same (extra turn), first. Use this for dealer-after-player order or 'keep going until you fail' turns that plain rotation cannot express.",
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
      "Post forced bets before the deal. Each entry caps at that seat's stack, so a short stack is put all-in automatically.",
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
      "Split the pot into main and side pots from what each seat committed this hand, with the seats eligible for each. Folded seats still fund the layers they paid into.",
    inputSchema: EMPTY_SCHEMA,
    annotations: { readOnlyHint: true },
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
      "Pay a pot to one or more winners, splitting evenly. Pass amount to settle a single side pot from get_pots; omit it to award the whole pot.",
    inputSchema: {
      type: "object",
      properties: {
        winnerIds: { type: "array", items: { type: "string" } },
        amount: { type: "number" },
      },
      required: ["winnerIds"],
    } as const,
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
      "Adjust a seat's stack directly by a positive or negative amount — Blackjack wager settlement, bonuses, or penalties outside the pot.",
    inputSchema: {
      type: "object",
      properties: {
        playerId: { type: "string" },
        amount: { type: "number" },
      },
      required: ["playerId", "amount"],
    } as const,
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
      "Clear betting bookkeeping. scope 'betting' clears the current round's contributions and current bet (between streets); scope 'hand' also clears per-hand commitments and unfolds every seat (new hand).",
    inputSchema: {
      type: "object",
      properties: {
        scope: { type: "string", enum: ["betting", "hand"] },
      },
    } as const,
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
          text: SKILL_MD,
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
          text: REFERENCE_MD,
        },
      ],
    }),
  });

  return null;
}
