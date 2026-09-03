import { createSession, narrate } from "../engine";
import type { CreateGameOptions, GameSession, SessionMode } from "../types";
import catalog from "./catalog.json";
import blackjack from "./blackjack.json";
import goFish from "./go-fish.json";
import texasHoldem from "./texas-holdem.json";
import war from "./war.json";
import type { GamePreset, PresetCatalogEntry } from "./types";

const PRESETS: Record<string, GamePreset> = {
  [texasHoldem.id]: texasHoldem as GamePreset,
  [blackjack.id]: blackjack as GamePreset,
  [war.id]: war as GamePreset,
  [goFish.id]: goFish as GamePreset,
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

/**
 * Build a session from a catalog preset. Caller overrides (mode, botCount, etc.)
 * win over JSON defaults. name always comes from the preset unless overridden.
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
    phase: overrides.phase ?? preset.phase,
    legalActions: overrides.legalActions ?? preset.legalActions,
    instructions: overrides.instructions ?? preset.instructions,
  });

  if (preset.openingNarration) {
    return narrate(session, preset.openingNarration);
  }
  return session;
}

/** Convenience for landing / store: start a preset in a given mode. */
export function startPresetSession(
  id: string,
  mode: SessionMode = "practice",
  botCount?: number,
): GameSession {
  return createFromPreset(id, { mode, botCount });
}
