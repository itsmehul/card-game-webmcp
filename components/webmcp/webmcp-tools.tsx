"use client";

import {
  gameStore,
  listPresetIds,
  listPresets,
  type CreateGameOptions,
  type Highlight,
} from "@/lib/game";
import { useWebMCP, useWebMCPResource } from "@mcp-b/react-webmcp";

const EMPTY_SCHEMA = {
  type: "object",
  properties: {},
} as const;

const PRESET_IDS = listPresetIds() as [string, ...string[]];

const HIGHLIGHT_SCHEMA = {
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

function requireSession() {
  const session = gameStore.getSnapshot();
  if (!session) {
    throw new Error("No active game. Call create_game first.");
  }
  return session;
}

function requireTutorial() {
  const session = requireSession();
  if (session.mode !== "tutorial") {
    throw new Error(
      "Tutorial-only tool. Recreate with mode: \"tutorial\", or use narrate / get_game_state in practice.",
    );
  }
  return session;
}

function applyHighlight(args: {
  target?: unknown;
  playerId?: unknown;
  label?: unknown;
  actionId?: unknown;
}) {
  if (!args?.target && !args?.actionId) {
    gameStore.setHighlight(null);
    return null;
  }
  const highlight: Highlight = {
    target: args.target ? String(args.target) : "actions",
    playerId: args.playerId ? String(args.playerId) : undefined,
    label: args.label ? String(args.label) : undefined,
    actionId: args.actionId ? String(args.actionId) : undefined,
  };
  gameStore.setHighlight(highlight);
  return highlight;
}

/**
 * Discovery & setup — always registered so the agent can browse presets
 * and create a game even when no session is active.
 */
function DiscoveryTools() {
  useWebMCP({
    name: "list_presets",
    description:
      "List every catalog preset with its id, display name, and one-line summary. Call only before inventing a custom game — skip when the user already named a catalog preset (e.g. blackjack).",
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
      "Create a new card-game session and reset the table (navigates this tab to /game/<newId>). Call on any already-connected Playing cards simulator source from webmcp_list_sources — home `/` or `/game/...`; deep links are hints that the site is open, not a required URL. Do not webmcp_open_page when a same-origin source exists. Catalog: pass preset (e.g. blackjack, war). Custom: omit preset; pass name and an XState-compatible machine JSON (see skills://card-table/reference.md). The machine owns phases, human controls, bots, and rewards. Session tools (get_game_state, narrate, highlight, await_user_action, coach) are always listed — they error until a session exists. Tutorial: prefer coach, or highlight + narrate + await_user_action (await/coach return state — do not get_game_state after).",
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
            "tutorial: teach with coach (or highlight + narrate + await_user_action); never move the human. practice: human clicks machine controls; agent only explains. Machines own bots and settlement.",
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
              ? "Tutorial: prefer coach({ text, target, expectActionId }), or highlight + narrate + await_user_action. await/coach return state — skip get_game_state. Never click for the human. Do not re-narrate machine event lines. Do not webmcp_open_page or webmcp_list_tools while this session's source is connected."
              : "Machine owns progression. Explain with narrate; do not invent phases or awards.",
          state: gameStore.getStatePayload(),
        });
      } catch (e) {
        return fail(
          e,
          "For catalog games pass a valid preset id from list_presets (or the create_game enum). For custom games pass name and machine.",
        );
      }
    },
  });

  return null;
}

/**
 * Session tools — always registered so schemas are discoverable before
 * create_game. Execute fails with a hint until a session exists.
 */
function GameSessionTools() {
  useWebMCP({
    name: "get_game_state",
    description:
      "Read compact agent state: seats, chips, pots, legalActions, in-play cards, stockCount, last 3 narration lines. Prefer state returned by create_game / await_user_action / coach. Call only when that payload was lost or you need a refresh without waiting.",
    inputSchema: EMPTY_SCHEMA,
    annotations: {
      readOnlyHint: true,
      openWorldHint: false,
      untrustedContentHint: true,
    },
    execute: async () => {
      try {
        requireSession();
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
        requireSession();
        gameStore.setInstructions(String(args?.text ?? ""));
        return ok({
          instructions: gameStore.getSnapshot()?.instructions ?? "",
        });
      } catch (e) {
        return fail(e, "Call create_game first to start a session.");
      }
    },
  });

  useWebMCP({
    name: "highlight",
    description:
      "Visually highlight a UI element with a glowing border so the student knows where to look or click. Prefer coach when also awaiting a click. Call with no arguments (or target null) to clear.",
    inputSchema: HIGHLIGHT_SCHEMA,
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    execute: async (args) => {
      try {
        requireSession();
        return ok({ highlight: applyHighlight(args ?? {}) });
      } catch (e) {
        return fail(e, "Call create_game first to start a session.");
      }
    },
  });

  useWebMCP({
    name: "narrate",
    description:
      "Append one short teaching line to the student log. Machine already logs event lines (bet placed, dealt, win) — only add what it did not say (totals, why Hit/Stand). Returns the appended entry only.",
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
        requireSession();
        const entry = gameStore.narrate(String(args?.text ?? ""));
        return ok({ entry });
      } catch (e) {
        return fail(e, "Call create_game first to start a session.");
      }
    },
  });

  return null;
}

/**
 * Tutorial tools — always registered for schema discovery; execute requires
 * an active tutorial session.
 */
function TutorialTools() {
  useWebMCP({
    name: "await_user_action",
    description:
      "Block until the human clicks a control, then return the click plus compact state. Tutorial-only. Prefer coach when you also need narrate/highlight. Pass expectActionId for a recommended action (matched:false if they clicked something else). Do not call get_game_state after a successful await. Resolves with { timedOut: true } after timeoutMs.",
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
        requireTutorial();
        const result = await gameStore.resolveTutorialAwait({
          expectActionId: args?.expectActionId
            ? String(args.expectActionId)
            : undefined,
          timeoutMs: args?.timeoutMs ? Number(args.timeoutMs) : undefined,
        });
        return ok(result);
      } catch (e) {
        return fail(
          e,
          "Need an active tutorial session. Recreate with mode: \"tutorial\" if the game ended while waiting.",
        );
      }
    },
  });

  useWebMCP({
    name: "coach",
    description:
      "Tutorial one-shot: optional narrate + highlight, then await a human click. Returns the click result plus compact state — do not call get_game_state after. Prefer over separate narrate/highlight/await when teaching one step. With expectActionId, the click cue glows on that action button (defaults target to actions).",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description:
            "Optional teaching line (skip if the machine already narrated the event).",
        },
        target: HIGHLIGHT_SCHEMA.properties.target,
        playerId: HIGHLIGHT_SCHEMA.properties.playerId,
        label: HIGHLIGHT_SCHEMA.properties.label,
        expectActionId: {
          type: "string",
          description:
            "Action id to wait for (e.g. 'stand'). Omit to accept any click.",
        },
        timeoutMs: {
          type: "number",
          description:
            "Optional max wait in milliseconds. On expiry resolves with { timedOut: true }.",
        },
      },
    } as const,
    annotations: { readOnlyHint: false, openWorldHint: false },
    execute: async (args) => {
      try {
        requireTutorial();
        const entry = args?.text
          ? gameStore.narrate(String(args.text))
          : undefined;
        const expectActionId = args?.expectActionId
          ? String(args.expectActionId)
          : undefined;
        // Click cues always pin to the expected action button so labels are not
        // clipped on top seats and the student sees exactly what to press.
        if (args?.target !== undefined || expectActionId) {
          applyHighlight({
            target:
              args?.target !== undefined && args?.target !== null
                ? args.target
                : expectActionId
                  ? "actions"
                  : undefined,
            playerId: args?.playerId,
            label: args?.label,
            actionId: expectActionId,
          });
        }
        const result = await gameStore.resolveTutorialAwait({
          expectActionId,
          timeoutMs: args?.timeoutMs ? Number(args.timeoutMs) : undefined,
        });
        return ok(entry ? { ...result, entry } : result);
      } catch (e) {
        return fail(
          e,
          "Need an active tutorial session. Recreate with mode: \"tutorial\".",
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
    name: "Playing cards simulator Skill",
    description:
      "Playbook for Playing cards simulator WebMCP tools: which tool to call, when, and catalog follow-through recipes.",
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
    name: "Playing cards simulator Reference",
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
 * Discovery + session + tutorial tools are always registered so schemas are
 * visible before create_game; session/tutorial executes fail until ready.
 */
export function WebMCPTools() {
  return (
    <>
      <DiscoveryTools />
      <GameSessionTools />
      <TutorialTools />
      <SkillResources />
    </>
  );
}
