"use client";

import { useSyncExternalStore } from "react";
import {
  allIn,
  applyHumanLegalAction,
  awardChips,
  awardPot,
  capture,
  chipAction,
  collectSets,
  computePots,
  createSession,
  deal,
  dealBatch,
  dealToPlay,
  discard,
  draw,
  getOmniscientState,
  moveTurn,
  narrate,
  play,
  playAll,
  postBlinds,
  resetBettingRound,
  resetHand,
  reveal,
  rotateTurn,
  setLegalActions,
  setMode,
  setPhase,
  setTurn,
  setInstructions,
  shuffle,
  sweepZone,
  transfer,
} from "./engine";
import {
  sendHumanEvent,
  startGameActor,
  syncActorSession,
  type GameActor,
} from "./machine";
import type { GameMachineConfig } from "./machine/types";
import { compareZone, findSets, scoreHand } from "./scoring";
import {
  isKnownPreset,
  startPresetWithActor,
} from "./presets";
import type {
  AwaitUserActionOptions,
  AwaitUserActionResult,
  ChipActionKind,
  CreateGameOptions,
  DealSpec,
  GameSession,
  HandScoring,
  Highlight,
  LegalAction,
  SeatTarget,
  SessionMode,
  SweepSpec,
  TransferSpec,
  Visibility,
  ZoneKind,
} from "./types";

type Listener = () => void;

let session: GameSession | null = null;
let actor: GameActor | null = null;
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

function setSession(next: GameSession | null) {
  session = next;
  emit();
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
): GameSession {
  stopActor();
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
    return bootMachine(machine, base);
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
    actor = started.actor;
    setSession(started.session);
    return started.session;
  },
  clear() {
    cancelPendingAwait("Game ended while awaiting a user action.");
    resetHumanActionLog();
    stopActor();
    setSession(null);
  },
  shuffle() {
    return mutateSession((s) => ({
      ...s,
      cards: shuffle(s.cards),
      players: s.players.map((p) => ({ ...p, folded: false })),
    }));
  },
  deal(playerId: string, count: number, visibility?: Visibility) {
    return mutateSession((s) => deal(s, playerId, count, visibility));
  },
  dealToPlay(count: number, visibility?: Visibility) {
    return mutateSession((s) => dealToPlay(s, count, visibility));
  },
  draw(playerId: string, count?: number, visibility?: Visibility) {
    return mutateSession((s) => draw(s, playerId, count, visibility));
  },
  play(playerId: string, cardIds: string[], visibility?: Visibility) {
    return mutateSession((s) => play(s, playerId, cardIds, visibility));
  },
  discard(playerId: string, cardIds: string[], visibility?: Visibility) {
    return mutateSession((s) => discard(s, playerId, cardIds, visibility));
  },
  capture(playerId: string, cardIds: string[], visibility?: Visibility) {
    return mutateSession((s) => capture(s, playerId, cardIds, visibility));
  },
  reveal(cardIds: string[], visibility?: Visibility) {
    return mutateSession((s) => reveal(s, cardIds, visibility));
  },
  rotateTurn() {
    return mutateSession((s) => rotateTurn(s));
  },
  setTurn(playerId: string) {
    return mutateSession((s) => setTurn(s, playerId));
  },
  moveTurn(target: SeatTarget | "next" | "previous" | "same" | "first") {
    return mutateSession((s) => moveTurn(s, target));
  },
  dealBatch(specs: DealSpec[]) {
    return mutateSession((s) => dealBatch(s, specs));
  },
  transfer(spec: TransferSpec) {
    return mutateSession((s) => transfer(s, spec));
  },
  playAll(count?: number, visibility?: Visibility) {
    return mutateSession((s) => playAll(s, count, visibility));
  },
  sweepZone(spec: SweepSpec) {
    return mutateSession((s) => sweepZone(s, spec));
  },
  collectSets(playerId: string, size?: number, toZone?: ZoneKind) {
    const result = collectSets(requireSession(), playerId, size, toZone);
    mutateSession(() => result.session);
    return { session: session!, sets: result.sets };
  },
  findSets(playerId: string, size: number) {
    return findSets(requireSession(), playerId, size);
  },
  scoreHand(playerId: string, scoring?: HandScoring) {
    return scoreHand(requireSession(), playerId, scoring);
  },
  compareZone(zone?: ZoneKind) {
    return compareZone(requireSession(), zone);
  },
  postBlinds(blinds: Array<{ playerId: string; amount: number }>) {
    return mutateSession((s) => postBlinds(s, blinds));
  },
  allIn(playerId: string) {
    return mutateSession((s) => allIn(s, playerId));
  },
  computePots() {
    return computePots(requireSession());
  },
  awardPot(winnerIds: string[], amount?: number) {
    return mutateSession((s) => awardPot(s, winnerIds, amount));
  },
  awardChips(playerId: string, amount: number) {
    return mutateSession((s) => awardChips(s, playerId, amount));
  },
  resetBettingRound() {
    return mutateSession((s) => resetBettingRound(s));
  },
  resetHand() {
    return mutateSession((s) => resetHand(s));
  },
  setPhase(phase: string) {
    return mutateSession((s) => setPhase(s, phase));
  },
  setLegalActions(actions: LegalAction[]) {
    return mutateSession((s) => setLegalActions(s, actions));
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
  ackUserAction() {
    ackedSeq = humanActionSeq;
  },
  setMode(mode: SessionMode) {
    return mutateSession((s) => setMode(s, mode));
  },
  chipAction(playerId: string, action: ChipActionKind, amount?: number) {
    return mutateSession((s) => chipAction(s, playerId, action, amount));
  },
  narrate(text: string) {
    return mutateSession((s) => narrate(s, text));
  },
  setInstructions(text: string) {
    return mutateSession((s) => setInstructions(s, text));
  },
  setHighlight(highlight: Highlight | null) {
    return mutateSession((s) => ({ ...s, highlight }));
  },
  applyMove(input: {
    playerId: string;
    primitive:
      | "draw"
      | "deal_all"
      | "play"
      | "play_all"
      | "discard"
      | "capture"
      | "collect_sets"
      | "reveal"
      | "pass"
      | "fold"
      | "check"
      | "call"
      | "bet"
      | "raise"
      | "all_in";
    cardIds?: string[];
    count?: number;
    amount?: number;
    setSize?: number;
    visibility?: Visibility;
    fromAgent?: boolean;
  }) {
    const s = requireSession();
    const isHuman = input.playerId === "human";
    if (input.fromAgent && (isHuman || input.primitive === "play_all")) {
      throw new Error(
        "The human plays their own cards via the on-screen buttons in both tutorial and practice mode. To teach in tutorial, highlight the action (highlight) and narrate what to do (narrate) — do not move the human seat.",
      );
    }

    switch (input.primitive) {
      case "deal_all": {
        return mutateSession((cur) => {
          let next = cur;
          for (const p of next.players) {
            if (!p.folded) {
              next = deal(
                next,
                p.id,
                input.count ?? 1,
                input.visibility ?? "hidden",
              );
            }
          }
          return next;
        });
      }
      case "pass":
        return session!;
      case "draw":
        return this.draw(input.playerId, input.count ?? 1, input.visibility);
      case "play":
        return this.play(
          input.playerId,
          input.cardIds ?? [],
          input.visibility,
        );
      case "discard":
        return this.discard(
          input.playerId,
          input.cardIds ?? [],
          input.visibility,
        );
      case "capture":
        return this.capture(
          input.playerId,
          input.cardIds ?? [],
          input.visibility,
        );
      case "play_all":
        return this.playAll(input.count ?? 1, input.visibility ?? "public");
      case "collect_sets":
        return this.collectSets(input.playerId, input.setSize ?? 4).session;
      case "reveal":
        return this.reveal(input.cardIds ?? [], input.visibility);
      case "all_in":
        return this.allIn(input.playerId);
      case "fold":
      case "check":
      case "call":
      case "bet":
      case "raise":
        return this.chipAction(input.playerId, input.primitive, input.amount);
      default:
        throw new Error(`Unknown primitive: ${input.primitive}`);
    }
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
