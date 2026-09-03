import { setup, createActor, assign } from "xstate";
import type { GameSession } from "../types";
import { gameActions, gameGuards } from "./registry";
import { projectSession } from "./project";
import type {
  GameMachineConfig,
  GameMachineContext,
  GameMachineEvent,
} from "./types";

// Loose actor handle — concrete machine types vary per preset JSON.
export type GameActor = {
  send: (event: unknown) => void;
  getSnapshot: () => { context: GameMachineContext; value: unknown; getMeta: () => Record<string, unknown> };
  start: () => void;
  stop: () => void;
};

type SyncEvent = { type: "__SYNC__"; session: GameSession };

/**
 * Build an XState machine from a JSON-serializable config + live session.
 * Actions/guards resolve by name against the shared registry.
 * Root `__SYNC__` lets the store push narration/highlight mutations into context.
 */
export function createGameMachine(
  config: GameMachineConfig,
  session: GameSession,
) {
  const machineSetup = setup({
    types: {} as {
      context: GameMachineContext;
      events: GameMachineEvent | SyncEvent;
    },
    actions: {
      ...gameActions,
      __syncSession: assign(({ event }) => ({
        session: (event as SyncEvent).session,
      })),
    } as never,
    guards: gameGuards as never,
  });

  const rootOn = (config as { on?: Record<string, unknown> }).on ?? {};

  return machineSetup.createMachine({
    ...(config as object),
    context: { session },
    on: {
      ...rootOn,
      __SYNC__: { actions: "__syncSession" },
    },
  } as never);
}

export function startGameActor(
  config: GameMachineConfig,
  session: GameSession,
): { actor: GameActor; session: GameSession } {
  const machine = createGameMachine(config, session);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actor = createActor(machine as any);
  actor.start();
  return {
    actor: actor as unknown as GameActor,
    session: projectSession(actor.getSnapshot() as never),
  };
}

export function sendHumanEvent(
  actor: GameActor,
  eventType: string,
  opts?: { selectedCardIds?: string[]; amount?: number },
): GameSession {
  actor.send({
    type: eventType,
    selectedCardIds: opts?.selectedCardIds,
    amount: opts?.amount,
  } as GameMachineEvent);
  return projectSession(actor.getSnapshot() as never);
}

/** Push an externally mutated session into the actor without changing state. */
export function syncActorSession(
  actor: GameActor,
  next: GameSession,
): GameSession {
  actor.send({ type: "__SYNC__", session: next } as SyncEvent);
  return projectSession(actor.getSnapshot() as never);
}
