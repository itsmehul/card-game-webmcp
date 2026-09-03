"use client";

import { useWebMCP, useWebMCPResource } from "@mcp-b/react-webmcp";
import {
  gameStore,
  useGameSession,
  listPresetIds,
  listPresets,
  type CreateGameOptions,
} from "@/lib/game";

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
} as const;

const PRESET_IDS = listPresetIds() as [string, ...string[]];

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

/**
 * Discovery & setup — always registered so the agent can browse presets
 * and create a game even when no session is active.
 */
function DiscoveryTools() {
  useWebMCP({
    name: "list_presets",
    description:
      "List every catalog preset with its id, display name, and one-line summary. Call this before inventing a custom game to avoid duplicating a built-in. Returns an array of preset objects.",
    inputSchema: EMPTY_SCHEMA,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      untrustedContentHint: false,
    },
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
      "Create a new card-game session and reset the table. Catalog: pass preset (e.g. blackjack, war). Custom: omit preset; pass name and an XState-compatible machine JSON (see skills://card-table/reference.md). The machine owns phases, human controls, bots, and rewards. Explain with narrate / get_game_state; in tutorial use highlight + await_user_action.",
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
            "tutorial: teach with highlight + narrate + await_user_action (never move the human). practice: human clicks machine controls; agent only explains. Machines own bots and settlement.",
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
          description:
            "How to present shared play cards. Use stack for one face-down pile, such as Bullshit.",
        },
        machine: {
          type: "object",
          description:
            "XState machine JSON (required for custom games). States, meta.controls, named actions/guards — see skills://card-table/reference.md",
        },
        instructions: {
          type: "string",
          description:
            "Student-facing how-to for the How to play sidebar. Replace anytime with set_instructions.",
        },
      },
    } as const,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    execute: async (args) => {
      try {
        const session = gameStore.createGame({
          name: args?.name !== undefined ? String(args.name) : undefined,
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
          machine: args?.machine as CreateGameOptions["machine"],
          instructions:
            args?.instructions !== undefined
              ? String(args.instructions)
              : undefined,
        });
        return ok({
          message: `Created ${session.name}`,
          hint:
            session.mode === "tutorial"
              ? "Tutorial: highlight + narrate + await_user_action. Never click for the human."
              : "Machine owns progression. Explain with narrate; do not invent phases or awards.",
          state: gameStore.getStatePayload(),
        });
      } catch (e) {
        return fail(
          e,
          "For catalog games pass a valid preset id from list_presets. For custom games pass name and machine.",
        );
      }
    },
  });

  return null;
}

/**
 * Session tools — registered only while a game is active.
 * Progression lives in the XState machine; agents explain, they do not deal/bet/settle.
 */
function GameSessionTools() {
  useWebMCP({
    name: "get_game_state",
    description:
      "Read the compact agent state: seats, chips, pots, legalActions (from the machine), in-play cards (not stock), stockCount, and the last 3 narration lines. Call after the human acts or when you need a fresh snapshot.",
    inputSchema: EMPTY_SCHEMA,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      untrustedContentHint: true,
    },
    execute: async () => {
      try {
        return ok(gameStore.getStatePayload());
      } catch (e) {
        return fail(e, "Call create_game first to start a session.");
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
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      untrustedContentHint: true,
    },
    execute: async (args) => {
      try {
        gameStore.setInstructions(String(args?.text ?? ""));
        return ok({
          instructions: gameStore.getSnapshot()?.instructions ?? "",
        });
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
          description:
            "Optional short label shown near the highlighted element (e.g. 'Click here', 'Your hand').",
        },
      },
    } as const,
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
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
 * Tutorial-only: blocks until the human clicks a machine control, then
 * returns what they did. Resolves from applyHumanLegalAction in the store.
 */
function TutorialAwaitTool() {
  useWebMCP({
    name: "await_user_action",
    description:
      "Block until the human clicks a control on the table, then return what they did. Tutorial-only. Pass expectActionId to wait for a specific recommended action; if the human clicks a different action the result has matched:false so you can re-narrate and re-highlight. Always call highlight + narrate first (controls come from the machine). Resolves with { timedOut: true } after timeoutMs; rejects if the game ends while waiting.",
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
 * Resources — always registered so agents can read the playbook before a game starts.
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
      "XState machine JSON for custom games: states, meta.controls, named actions/guards. Catalog games already ship machines.",
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
 * Discovery (list_presets, create_game) + skill resources always on.
 * Session tools when a game exists; await_user_action only in tutorial.
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
