"use client";

import { useSyncExternalStore } from "react";
import {
  applyHumanLegalAction,
  createSession,
  getOmniscientState,
  narrate,
  setMode,
  setInstructions,
} from "./engine";
import {
  restoreGameActor,
  sendHumanEvent,
  startGameActor,
  syncActorSession,
  type GameActor,
} from "./machine";
import type { GameMachineConfig } from "./machine/types";
import {
  loadPersistedGame,
  removePersistedGame,
  savePersistedGame,
} from "./persistence";
import {
  isKnownPreset,
  startPresetWithActor,
} from "./presets";
import type {
  AwaitUserActionOptions,
  AwaitUserActionResult,
  CreateGameOptions,
  GameSession,
  Highlight,
  LegalAction,
  SessionMode,
} from "./types";

type Listener = () => void;

let session: GameSession | null = null;
let actor: GameActor | null = null;
let machineConfig: GameMachineConfig | null = null;
let presetId: string | null = null;
const listeners = new Set<Listener>();

type PendingAwait = {
  expectActionId?: string;
  timer?: ReturnType<typeof setTimeout>;
  abortSignal?: AbortSignal;
  abortListener?: () => void;
  resolve: (result: AwaitUserActionResult) => void;
  reject: (err: Error) => void;
};
let pendingAwait: PendingAwait | null = null;

let lastHumanAction: AwaitUserActionResult | null = null;
let humanActionSeq = 0;
let ackedSeq = 0;

function buildActionResult(
  action: LegalAction,
  opts: { selectedCardIds?: string[]; amount?: number } | undefined,
  expectActionId: string | undefined,
): AwaitUserActionResult {
  return {
    timedOut: false,
    actionId: action.id,
    label: action.label,
    matched: expectActionId ? action.id === expectActionId : true,
    selectedCardIds: opts?.selectedCardIds ?? [],
    amount: opts?.amount,
  };
}

function clearAwaitTimer(p: PendingAwait) {
  if (p.timer) clearTimeout(p.timer);
  if (p.abortSignal && p.abortListener) {
    p.abortSignal.removeEventListener("abort", p.abortListener);
  }
}

function resetHumanActionLog() {
  lastHumanAction = null;
  humanActionSeq = 0;
  ackedSeq = 0;
}

function unackedClick(
  expectActionId: string | undefined,
): AwaitUserActionResult | null {
  if (humanActionSeq <= ackedSeq || !lastHumanAction) return null;
  const matched = expectActionId
    ? lastHumanAction.actionId === expectActionId
    : true;
  return { ...lastHumanAction, matched };
}

function cancelPendingAwait(reason: string) {
  if (!pendingAwait) return;
  clearAwaitTimer(pendingAwait);
  const p = pendingAwait;
  pendingAwait = null;
  p.reject(new Error(reason));
}

function emit() {
  for (const listener of listeners) listener();
}

function stopActor() {
  if (actor) {
    actor.stop();
    actor = null;
  }
}

function persistCurrent(): void {
  if (!session || !machineConfig || !actor) return;
  try {
    savePersistedGame(session.id, {
      version: 1,
      presetId,
      machine: machineConfig,
      actorSnapshot: actor.getPersistedSnapshot(),
    });
  } catch {
    // Ignore persistence failures.
  }
}

function setSession(next: GameSession | null) {
  session = next;
  if (next) persistCurrent();
  emit();
}

function clearMachineMeta() {
  machineConfig = null;
  presetId = null;
}

/**
 * Apply an engine mutation and keep the XState actor context in sync so
 * subsequent human events see narration / chip / card updates.
 */
function mutateSession(updater: (s: GameSession) => GameSession): GameSession {
  const current = requireSession();
  const highlight = current.highlight;
  const mutated = updater(current);
  if (actor) {
    const projected = syncActorSession(actor, {
      ...mutated,
      // Actor context stores table data; phase/controls are projected from state.
      legalActions: [],
    });
    session = { ...projected, highlight: mutated.highlight ?? highlight };
    persistCurrent();
    emit();
    return session;
  }
  setSession(mutated);
  return mutated;
}

function requireSession(): GameSession {
  if (!session) throw new Error("No active game. Call create_game first.");
  return session;
}

function bootMachine(
  machine: GameMachineConfig,
  base: GameSession,
  nextPresetId: string | null = null,
): GameSession {
  stopActor();
  machineConfig = machine;
  presetId = nextPresetId;
  const started = startGameActor(machine, base);
  actor = started.actor;
  setSession(started.session);
  return started.session;
}

export const gameStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): GameSession | null {
    return session;
  },
  getServerSnapshot(): GameSession | null {
    return null;
  },
  createGame(options: CreateGameOptions): GameSession {
    const known = Boolean(options.preset && isKnownPreset(options.preset));
    if (!known && !options.name?.trim()) {
      throw new Error(
        "create_game needs a name when inventing a custom game. Pass preset to start a catalog game.",
      );
    }
    cancelPendingAwait("A new game started while awaiting a user action.");
    resetHumanActionLog();

    if (known) {
      const started = startPresetWithActor(options.preset!, options);
      stopActor();
      machineConfig = started.machine;
      presetId = options.preset!;
      actor = started.actor;
      setSession(started.session);
      return started.session;
    }

    const machine = options.machine;
    if (!machine) {
      throw new Error(
        "Custom games need a machine (XState JSON). Catalog games: pass preset from list_presets.",
      );
    }
    const base = createSession(options);
    return bootMachine(machine, base, null);
  },
  startPreset(
    id: string,
    mode: SessionMode = "practice",
    botCount?: number,
  ) {
    cancelPendingAwait("A new game started while awaiting a user action.");
    resetHumanActionLog();
    const started = startPresetWithActor(id, { mode, botCount });
    stopActor();
    machineConfig = started.machine;
    presetId = id;
    actor = started.actor;
    setSession(started.session);
    return started.session;
  },
  /**
   * Restore a session from localStorage by id.
   * Returns true when hydrate succeeded.
   */
  hydrate(id: string): boolean {
    if (session?.id === id && actor) return true;
    const persisted = loadPersistedGame(id);
    if (!persisted) return false;
    try {
      cancelPendingAwait("Session restored while awaiting a user action.");
      resetHumanActionLog();
      stopActor();
      const restored = restoreGameActor(
        persisted.machine,
        persisted.actorSnapshot,
      );
      machineConfig = persisted.machine;
      presetId = persisted.presetId;
      actor = restored.actor;
      session = restored.session;
      // Re-save so storage stays in sync with projected session.
      persistCurrent();
      emit();
      return true;
    } catch {
      return false;
    }
  },
  clear() {
    cancelPendingAwait("Game ended while awaiting a user action.");
    resetHumanActionLog();
    if (session) removePersistedGame(session.id);
    stopActor();
    clearMachineMeta();
    setSession(null);
  },
  applyHumanLegalAction(
    action: LegalAction,
    opts?: { selectedCardIds?: string[]; amount?: number },
  ) {
    if (actor && action.event) {
      const projected = sendHumanEvent(actor, action.event, opts);
      setSession(projected);
    } else {
      const after = applyHumanLegalAction(requireSession(), action, opts);
      setSession(after.highlight ? { ...after, highlight: null } : after);
    }
    lastHumanAction = buildActionResult(action, opts, undefined);
    humanActionSeq += 1;
    if (pendingAwait) {
      clearAwaitTimer(pendingAwait);
      const p = pendingAwait;
      pendingAwait = null;
      p.resolve(buildActionResult(action, opts, p.expectActionId));
    }
    return session!;
  },
  awaitUserAction(
    opts: AwaitUserActionOptions = {},
  ): Promise<AwaitUserActionResult> {
    if (pendingAwait) {
      clearAwaitTimer(pendingAwait);
      const stale = pendingAwait;
      pendingAwait = null;
      stale.resolve({ timedOut: true });
    }
    const replayed = unackedClick(opts.expectActionId);
    if (replayed) return Promise.resolve(replayed);

    return new Promise<AwaitUserActionResult>((resolve, reject) => {
      const entry: PendingAwait = {
        expectActionId: opts.expectActionId,
        resolve,
        reject,
      };
      const settleTimeout = () => {
        if (pendingAwait !== entry) return;
        clearAwaitTimer(entry);
        pendingAwait = null;
        resolve({ timedOut: true });
      };
      if (opts.signal) {
        if (opts.signal.aborted) {
          resolve({ timedOut: true });
          return;
        }
        entry.abortSignal = opts.signal;
        entry.abortListener = settleTimeout;
        opts.signal.addEventListener("abort", settleTimeout);
      }
      if (opts.timeoutMs && opts.timeoutMs > 0) {
        entry.timer = setTimeout(settleTimeout, opts.timeoutMs);
      }
      pendingAwait = entry;
    });
  },
  /**
   * Tutorial tool helper: wait for a click, ack it, and attach compact state
   * so agents do not need a follow-up get_game_state.
   */
  async resolveTutorialAwait(
    opts: AwaitUserActionOptions = {},
  ): Promise<AwaitUserActionResult & { state?: ReturnType<typeof getOmniscientState> }> {
    const result = await gameStore.awaitUserAction(opts);
    if (result.timedOut || result.cancelled) return result;
    gameStore.ackUserAction();
    return { ...result, state: gameStore.getStatePayload() };
  },
  ackUserAction() {
    ackedSeq = humanActionSeq;
  },
  setMode(mode: SessionMode) {
    return mutateSession((s) => setMode(s, mode));
  },
  narrate(text: string) {
    const next = mutateSession((s) => narrate(s, text));
    return next.narration[next.narration.length - 1]!;
  },
  setInstructions(text: string) {
    return mutateSession((s) => setInstructions(s, text));
  },
  setHighlight(highlight: Highlight | null) {
    return mutateSession((s) => ({ ...s, highlight }));
  },
  getStatePayload() {
    return getOmniscientState(requireSession());
  },
  /** Exposed for tests / debugging. */
  getActor(): GameActor | null {
    return actor;
  },
};

export function useGameSession(): GameSession | null {
  return useSyncExternalStore(
    gameStore.subscribe,
    gameStore.getSnapshot,
    gameStore.getServerSnapshot,
  );
}
