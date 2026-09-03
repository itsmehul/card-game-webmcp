import type {
  EnabledZones,
  LegalAction,
  PlayLayout,
  SessionMode,
  TurnDirection,
} from "../types";

/** Landing-catalog entry (lightweight). */
export interface PresetCatalogEntry {
  id: string;
  name: string;
  summary: string;
}

/**
 * Full JSON preset — serializable CreateGameOptions plus landing fields
 * and an optional opening narration line.
 */
export interface GamePreset extends PresetCatalogEntry {
  botCount?: number;
  jokers?: boolean;
  chips?: boolean;
  startingStack?: number;
  turnDirection?: TurnDirection;
  enabledZones?: Partial<EnabledZones>;
  playLayout?: PlayLayout;
  phase?: string;
  legalActions?: LegalAction[];
  instructions?: string;
  openingNarration?: string;
  /** Default mode when started from the landing without override */
  mode?: SessionMode;
}
