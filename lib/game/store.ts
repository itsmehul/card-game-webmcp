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
    setSession(next);
    return next;
  },
  startPreset(
    id: string,
    mode: SessionMode = "practice",
    botCount?: number,
  ) {
    const next = startPresetSession(id, mode, botCount);
    setSession(next);
    return next;
  },
  clear() {
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
    setSession(applyHumanLegalAction(requireSession(), action, opts));
    return session!;
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
    if (input.fromAgent && isHuman) {
      throw new Error(
        "The human plays their own cards via the on-screen buttons in both tutorial and practice mode. To teach in tutorial, highlight the action (highlight) and narrate what to do (narrate) — do not move the human seat.",
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

export function useGameSession(): GameSession | null {
  return useSyncExternalStore(
    gameStore.subscribe,
    gameStore.getSnapshot,
    gameStore.getServerSnapshot,
  );
}
