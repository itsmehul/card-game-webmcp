import type {
  EnabledZones,
  LegalAction,
  PlayLayout,
  SessionMode,
  TurnDirection,
} from "../types";
import type { GameMachineConfig } from "../machine/types";

/** Landing-catalog entry (lightweight). */
export interface PresetCatalogEntry {
  id: string;
  name: string;
  summary: string;
}

/**
 * Full JSON preset — table setup plus an XState machine that owns
 * phase flow, legal controls, bots, and settlement.
 */
export interface GamePreset extends PresetCatalogEntry {
  botCount?: number;
  jokers?: boolean;
  chips?: boolean;
  startingStack?: number;
  turnDirection?: TurnDirection;
  enabledZones?: Partial<EnabledZones>;
  playLayout?: PlayLayout;
  /** @deprecated Prefer machine.initial / meta — kept for overrides */
  phase?: string;
  /** @deprecated Prefer machine meta.controls */
  legalActions?: LegalAction[];
  /** XState machine config (required for catalog games). */
  machine: GameMachineConfig;
  instructions?: string;
  openingNarration?: string;
  /** Default mode when started from the landing without override */
  mode?: SessionMode;
}
