import type { SnapshotFrom, AnyStateMachine } from "xstate";
import type { GameSession, LegalAction } from "../types";
import {
  controlToLegalAction,
  type MachineControl,
  type MachineStateMeta,
} from "./types";

function leafStateIds(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([key, nested]) => {
        const kids = leafStateIds(nested);
        return kids.length ? kids.map((k) => `${key}.${k}`) : [key];
      },
    );
  }
  return [];
}

/** Flatten `meta.controls` from the current state (and parents). */
export function controlsFromSnapshot(
  snapshot: SnapshotFrom<AnyStateMachine>,
): MachineControl[] {
  const meta = snapshot.getMeta() as Record<string, MachineStateMeta>;
  const controls: MachineControl[] = [];
  for (const entry of Object.values(meta)) {
    if (entry?.controls?.length) controls.push(...entry.controls);
  }
  return controls;
}

export function phaseFromSnapshot(
  snapshot: SnapshotFrom<AnyStateMachine>,
): string {
  const value = snapshot.value;
  if (typeof value === "string") return value;
  const leaves = leafStateIds(value);
  return leaves[leaves.length - 1] ?? JSON.stringify(value);
}

/** Project actor snapshot onto GameSession phase + legalActions for the UI. */
export function projectSession(
  snapshot: SnapshotFrom<AnyStateMachine>,
): GameSession {
  const context = snapshot.context as { session: GameSession };
  const controls = controlsFromSnapshot(snapshot);
  const legalActions: LegalAction[] = controls.map(controlToLegalAction);
  return {
    ...context.session,
    phase: phaseFromSnapshot(snapshot),
    legalActions,
    highlight: null,
  };
}
