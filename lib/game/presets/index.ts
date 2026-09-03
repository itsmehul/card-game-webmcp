import { createSession, narrate } from "../engine";
import { startGameActor, type GameActor } from "../machine";
import type { GameMachineConfig } from "../machine/types";
import type { CreateGameOptions, GameSession, SessionMode } from "../types";
import catalog from "./catalog.json";
import blackjack from "./blackjack.json";
import bullshit from "./bullshit.json";
import crazyEights from "./crazy-eights.json";
import euchre from "./euchre.json";
import ginRummy from "./gin-rummy.json";
import goFish from "./go-fish.json";
import texasHoldem from "./texas-holdem.json";
import war from "./war.json";
import type { GamePreset, PresetCatalogEntry } from "./types";

const PRESETS: Record<string, GamePreset> = {
  [texasHoldem.id]: texasHoldem as GamePreset,
  [blackjack.id]: blackjack as GamePreset,
  [war.id]: war as GamePreset,
  [goFish.id]: goFish as GamePreset,
  [crazyEights.id]: crazyEights as GamePreset,
  [euchre.id]: euchre as GamePreset,
  [ginRummy.id]: ginRummy as GamePreset,
  [bullshit.id]: bullshit as GamePreset,
};

const CATALOG = catalog as PresetCatalogEntry[];

export type { GamePreset, PresetCatalogEntry } from "./types";

/** Ordered catalog entries for the landing grid. */
export function listPresets(): PresetCatalogEntry[] {
  return CATALOG.map((entry) => {
    const full = PRESETS[entry.id];
    return {
      id: entry.id,
      name: full?.name ?? entry.name,
      summary: full?.summary ?? entry.summary,
    };
  });
}

/** All known preset ids (for WebMCP enum / validation). */
export function listPresetIds(): string[] {
  return CATALOG.map((e) => e.id);
}

export function getPreset(id: string): GamePreset | null {
  return PRESETS[id] ?? null;
}

export function isKnownPreset(id: string): boolean {
  return id in PRESETS;
}

export function getPresetMachine(id: string): GameMachineConfig | null {
  return getPreset(id)?.machine ?? null;
}

/**
 * Build a session from a catalog preset (without starting the actor).
 * Caller overrides win over JSON defaults.
 */
export function createFromPreset(
  id: string,
  overrides: Partial<CreateGameOptions> = {},
): GameSession {
  const preset = getPreset(id);
  if (!preset) {
    throw new Error(
      `Unknown preset "${id}". Known presets: ${listPresetIds().join(", ")}`,
    );
  }

  const session = createSession({
    name: overrides.name ?? preset.name,
    botCount: overrides.botCount ?? preset.botCount,
    jokers: overrides.jokers ?? preset.jokers,
    mode: overrides.mode ?? preset.mode ?? "practice",
    turnDirection: overrides.turnDirection ?? preset.turnDirection,
    chips: overrides.chips ?? preset.chips,
    startingStack: overrides.startingStack ?? preset.startingStack,
    enabledZones: {
      ...preset.enabledZones,
      ...overrides.enabledZones,
    },
    playLayout: overrides.playLayout ?? preset.playLayout,
    phase: overrides.phase ?? preset.machine.initial,
    legalActions: overrides.legalActions ?? [],
    instructions: overrides.instructions ?? preset.instructions,
    machine: overrides.machine ?? preset.machine,
  });

  if (preset.openingNarration) {
    return narrate(session, preset.openingNarration);
  }
  return session;
}

/** Start preset session + XState actor; returns projected session. */
export function startPresetWithActor(
  id: string,
  overrides: Partial<CreateGameOptions> = {},
): { session: GameSession; actor: GameActor; machine: GameMachineConfig } {
  const preset = getPreset(id);
  if (!preset) {
    throw new Error(`Unknown preset "${id}"`);
  }
  const machine = (overrides.machine ?? preset.machine) as GameMachineConfig;
  const base = createFromPreset(id, overrides);
  const { actor, session } = startGameActor(machine, base);
  return { session, actor, machine };
}

/** Convenience for landing / store: start a preset in a given mode. */
export function startPresetSession(
  id: string,
  mode: SessionMode = "practice",
  botCount?: number,
): GameSession {
  return createFromPreset(id, { mode, botCount });
}
