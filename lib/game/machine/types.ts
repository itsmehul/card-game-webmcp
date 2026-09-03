import type {
  ActionPrimitive,
  ChipActionKind,
  GameSession,
  LegalAction,
} from "../types";

/** Serializable human control declared on a machine state via `meta.controls`. */
export interface MachineControl {
  id: string;
  label: string;
  /** Event type sent to the actor when the human clicks this control. */
  event: string;
  requiresCardSelection?: boolean;
  promptAmount?: boolean;
  minAmount?: number;
  maxAmount?: number;
  amount?: number;
  chipAction?: ChipActionKind;
  primitive?: ActionPrimitive;
  count?: number;
  setSize?: number;
}

export interface MachineStateMeta {
  controls?: MachineControl[];
}

export interface GameMachineContext {
  session: GameSession;
}

/** Human (and internal) events — type is free-form to match JSON machines. */
export type GameMachineEvent = {
  type: string;
  selectedCardIds?: string[];
  amount?: number;
};

/** Minimal JSON machine config accepted by createGameMachine. */
export interface GameMachineConfig {
  id?: string;
  initial: string;
  states: Record<string, unknown>;
  [key: string]: unknown;
}

/** Map a machine control onto the UI LegalAction shape. */
export function controlToLegalAction(control: MachineControl): LegalAction {
  return {
    id: control.id,
    label: control.label,
    event: control.event,
    requiresCardSelection: control.requiresCardSelection,
    promptAmount: control.promptAmount,
    minAmount: control.minAmount,
    maxAmount: control.maxAmount,
    amount: control.amount,
    chipAction: control.chipAction,
    primitive: control.primitive,
    count: control.count,
    setSize: control.setSize,
  };
}
