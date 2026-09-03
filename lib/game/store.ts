"use client";

import { useSyncExternalStore } from "react";
import {
  applyHumanLegalAction,
  capture,
  chipAction,
  createSession,
  deal,
  dealToPlay,
  discard,
  draw,
  getHumanView,
  getOmniscientState,
  narrate,
  play,
  reveal,
  rotateTurn,
  setLegalActions,
  setMode,
  setPhase,
  shuffle,
} from "./engine";
import { createTexasHoldem } from "./presets/texas-holdem";
import type {
  ChipActionKind,
  CreateGameOptions,
  GameSession,
  LegalAction,
  SessionMode,
  Visibility,
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
    const next =
      options.preset === "texas-holdem"
        ? createTexasHoldem(options)
        : createSession(options);
    setSession(next);
    return next;
  },
  startTexasHoldem(mode: SessionMode = "practice", botCount = 2) {
    const next = createTexasHoldem({ mode, botCount });
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
    opts?: { selectedCardId?: string | null; amount?: number },
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
  /**
   * Apply a move for a seat. In practice mode, human moves via UI only;
   * agents may still move bots. In tutorial, agent may move any seat.
   */
  applyMove(input: {
    playerId: string;
    primitive:
      | "draw"
      | "deal_all"
      | "play"
      | "discard"
      | "capture"
      | "reveal"
      | "pass"
      | "fold"
      | "check"
      | "call"
      | "bet"
      | "raise";
    cardIds?: string[];
    count?: number;
    amount?: number;
    visibility?: Visibility;
    fromAgent?: boolean;
  }) {
    const s = requireSession();
    const isHuman = input.playerId === "human";
    if (input.fromAgent && isHuman && s.mode === "practice") {
      throw new Error(
        "Practice mode: the human must play their own cards. Use tutorial mode to move for the human.",
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
      case "reveal":
        return this.reveal(input.cardIds ?? [], input.visibility);
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
    const s = requireSession();
    return {
      omniscient: getOmniscientState(s),
      humanView: getHumanView(s),
    };
  },
};

export function useGameSession(): GameSession | null {
  return useSyncExternalStore(
    gameStore.subscribe,
    gameStore.getSnapshot,
    gameStore.getServerSnapshot,
  );
}
