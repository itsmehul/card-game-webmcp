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
import { compareZone, findSets, scoreHand } from "./scoring";
import {
  createFromPreset,
  isKnownPreset,
  startPresetSession,
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
const listeners = new Set<Listener>();

/**
 * Tutorial await registry. At most one `await_user_action` call is pending at
 * a time — the agent's turn blocks on the tool, so true concurrency is not
 * possible in normal flow; the guards below are defensive.
 */
type PendingAwait = {
  expectActionId?: string;
  timer?: ReturnType<typeof setTimeout>;
  resolve: (result: AwaitUserActionResult) => void;
  reject: (err: Error) => void;
};
let pendingAwait: PendingAwait | null = null;

/**
 * Buffer for the most recent human legal-action that arrived with NO
 * pending await. In the tutorial loop the agent runs highlight + narrate
 * (each a WebMCP round-trip) BEFORE calling await_user_action, but the
 * next button is armed the instant the previous action is applied (via
 * nextActions). An engaged human will often click that next button during
 * that window — before any await is pending — and the click signal would be
 * lost. Buffering it lets the subsequent await_user_action resolve with the
 * click instead of hanging until the host times out. Only the most recent
 * click is kept; a new game clears it.
 */
let bufferedHumanAction: AwaitUserActionResult | null = null;

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
}

/** Reject an in-flight await because the session was replaced or cleared. */
function cancelPendingAwait(reason: string) {
  if (!pendingAwait) return;
  clearAwaitTimer(pendingAwait);
  const p = pendingAwait;
  pendingAwait = null;
  bufferedHumanAction = null;
  p.reject(new Error(reason));
}

function emit() {
  for (const listener of listeners) listener();
}

function setSession(next: GameSession | null) {
  session = next;
  emit();
}

function requireSession(): GameSession {
  if (!session) throw new Error("No active game. Call create_game first.");
  return session;
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
    const next = known
      ? createFromPreset(options.preset!, options)
      : createSession(options);
    cancelPendingAwait("A new game started while awaiting a user action.");
    bufferedHumanAction = null;
    setSession(next);
    return next;
  },
  startPreset(
    id: string,
    mode: SessionMode = "practice",
    botCount?: number,
  ) {
    const next = startPresetSession(id, mode, botCount);
    cancelPendingAwait("A new game started while awaiting a user action.");
    bufferedHumanAction = null;
    setSession(next);
    return next;
  },
  clear() {
    cancelPendingAwait("Game ended while awaiting a user action.");
    bufferedHumanAction = null;
    setSession(null);
  },
  shuffle() {
    const s = requireSession();
    setSession({
      ...s,
      cards: shuffle(s.cards),
      players: s.players.map((p) => ({ ...p, folded: false })),
      phase: "waiting_to_deal",
      legalActions: [],
    });
    return session!;
  },
  deal(playerId: string, count: number, visibility?: Visibility) {
    setSession(deal(requireSession(), playerId, count, visibility));
    return session!;
  },
  dealToPlay(count: number, visibility?: Visibility) {
    setSession(dealToPlay(requireSession(), count, visibility));
    return session!;
  },
  draw(playerId: string, count?: number, visibility?: Visibility) {
    setSession(draw(requireSession(), playerId, count, visibility));
    return session!;
  },
  play(playerId: string, cardIds: string[], visibility?: Visibility) {
    setSession(play(requireSession(), playerId, cardIds, visibility));
    return session!;
  },
  discard(playerId: string, cardIds: string[], visibility?: Visibility) {
    setSession(discard(requireSession(), playerId, cardIds, visibility));
    return session!;
  },
  capture(playerId: string, cardIds: string[], visibility?: Visibility) {
    setSession(capture(requireSession(), playerId, cardIds, visibility));
    return session!;
  },
  reveal(cardIds: string[], visibility?: Visibility) {
    setSession(reveal(requireSession(), cardIds, visibility));
    return session!;
  },
  rotateTurn() {
    setSession(rotateTurn(requireSession()));
    return session!;
  },
  setTurn(playerId: string) {
    setSession(setTurn(requireSession(), playerId));
    return session!;
  },
  moveTurn(target: SeatTarget | "next" | "previous" | "same" | "first") {
    setSession(moveTurn(requireSession(), target));
    return session!;
  },
  dealBatch(specs: DealSpec[]) {
    setSession(dealBatch(requireSession(), specs));
    return session!;
  },
  transfer(spec: TransferSpec) {
    setSession(transfer(requireSession(), spec));
    return session!;
  },
  playAll(count?: number, visibility?: Visibility) {
    setSession(playAll(requireSession(), count, visibility));
    return session!;
  },
  sweepZone(spec: SweepSpec) {
    setSession(sweepZone(requireSession(), spec));
    return session!;
  },
  collectSets(playerId: string, size?: number, toZone?: ZoneKind) {
    const result = collectSets(requireSession(), playerId, size, toZone);
    setSession(result.session);
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
    setSession(postBlinds(requireSession(), blinds));
    return session!;
  },
  allIn(playerId: string) {
    setSession(allIn(requireSession(), playerId));
    return session!;
  },
  computePots() {
    return computePots(requireSession());
  },
  awardPot(winnerIds: string[], amount?: number) {
    setSession(awardPot(requireSession(), winnerIds, amount));
    return session!;
  },
  awardChips(playerId: string, amount: number) {
    setSession(awardChips(requireSession(), playerId, amount));
    return session!;
  },
  resetBettingRound() {
    setSession(resetBettingRound(requireSession()));
    return session!;
  },
  resetHand() {
    setSession(resetHand(requireSession()));
    return session!;
  },
  setPhase(phase: string) {
    setSession(setPhase(requireSession(), phase));
    return session!;
  },
  setLegalActions(actions: LegalAction[]) {
    setSession(setLegalActions(requireSession(), actions));
    return session!;
  },
  applyHumanLegalAction(
    action: LegalAction,
    opts?: { selectedCardIds?: string[]; amount?: number },
  ) {
    // The highlight is a transient guide for the next click; once the human
    // performs an action it has served its purpose, so clear it so a stale
    // label (e.g. "Click here to deal") doesn't bleed into the next phase.
    const after = applyHumanLegalAction(requireSession(), action, opts);
    setSession(after.highlight ? { ...after, highlight: null } : after);
    // Settle a pending tutorial await, if any. The await resolves with the
    // *actual* action performed; matched is false when the agent expected a
    // different action id so it can course-correct. If NO await is pending
    // (the human clicked before the agent called await_user_action — the
    // common race in the tutorial loop), buffer the click so the next
    // await_user_action resolves with it instead of hanging.
    if (pendingAwait) {
      clearAwaitTimer(pendingAwait);
      const p = pendingAwait;
      pendingAwait = null;
      p.resolve(buildActionResult(action, opts, p.expectActionId));
    } else {
      bufferedHumanAction = buildActionResult(action, opts, undefined);
    }
    return session!;
  },
  /**
   * Block until the human clicks a legalAction button on the table, then
   * resolve with what they did. Tutorial-only. At most one await is pending
   * at a time; the agent's turn blocks on the tool, so a second call can only
   * arrive if the previous one was abandoned (the MCP client aborted the tool
   * call before it resolved). In that case the stale await is superseded
   * benignly — resolved with { timedOut: true } — so its dead consumer ignores
   * the result and no unhandled rejection fires, and the new await proceeds.
   * Resolves with { timedOut: true } after timeoutMs. Rejects if the game is
   * cleared or replaced while waiting.
   */
  awaitUserAction(
    opts: AwaitUserActionOptions = {},
  ): Promise<AwaitUserActionResult> {
    if (pendingAwait) {
      // A previous await was abandoned by its caller (the MCP client aborted
      // the tool call). Supersede it so the agent can retry cleanly instead of
      // being permanently locked out of await_user_action.
      clearAwaitTimer(pendingAwait);
      const stale = pendingAwait;
      pendingAwait = null;
      stale.resolve({ timedOut: true });
    }
    // If the human already clicked before this await was set up (the tutorial
    // race where nextActions armed the button during the agent's
    // highlight/narrate round-trips), consume that buffered click now.
    if (bufferedHumanAction) {
      const buffered = bufferedHumanAction;
      bufferedHumanAction = null;
      const matched = opts.expectActionId
        ? buffered.actionId === opts.expectActionId
        : true;
      return Promise.resolve({ ...buffered, matched });
    }
    return new Promise<AwaitUserActionResult>((resolve, reject) => {
      const entry: PendingAwait = {
        expectActionId: opts.expectActionId,
        resolve,
        reject,
      };
      if (opts.timeoutMs && opts.timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          if (pendingAwait === entry) {
            pendingAwait = null;
            resolve({ timedOut: true });
          }
        }, opts.timeoutMs);
      }
      pendingAwait = entry;
    });
  },
  setMode(mode: SessionMode) {
    setSession(setMode(requireSession(), mode));
    return session!;
  },
  chipAction(playerId: string, action: ChipActionKind, amount?: number) {
    setSession(chipAction(requireSession(), playerId, action, amount));
    return session!;
  },
  narrate(text: string) {
    setSession(narrate(requireSession(), text));
    return session!;
  },
  setInstructions(text: string) {
    setSession(setInstructions(requireSession(), text));
    return session!;
  },
  setHighlight(highlight: Highlight | null) {
    const s = requireSession();
    setSession({ ...s, highlight });
    return session!;
  },
  /**
   * Apply a move for a seat. The human seat is always driven by the human's
   * on-screen buttons — in both tutorial and practice. Agents may move bot
   * seats (e.g. a bot's bet or Go Fish response). In tutorial mode the agent
   * teaches by highlighting the action and narrating what to do; it must not
   * perform the human's action for them.
   */
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
    if (isHuman) {
      throw new Error(
        "The agent MUST NEVER execute commands or actions for the human user. The agent must ONLY highlight the recommended command (highlight) and give strategic insights (narrate), then wait for the human to click their on-screen button.",
      );
    }

    switch (input.primitive) {
      case "deal_all": {
        let next = s;
        for (const p of next.players) {
          if (!p.folded) {
            next = deal(next, p.id, input.count ?? 1, input.visibility ?? "hidden");
          }
        }
        setSession(next);
        return session!;
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
};

if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).gameStore = gameStore;
}

export function useGameSession(): GameSession | null {
  return useSyncExternalStore(
    gameStore.subscribe,
    gameStore.getSnapshot,
    gameStore.getServerSnapshot,
  );
}
