"use client";

import { PlayingCard } from "@/components/cards/playing-card";
import { actionIcon } from "@/components/game/action-icon";
import { ChipAmount } from "@/components/game/chip-amount";
import { GameCatalog } from "@/components/game/game-catalog";
import { TableSidebars } from "@/components/game/instructions-sidebar";
import { SessionUrlSync } from "@/components/game/session-url-sync";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MaterialIcon } from "@/components/ui/material-icon";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { WebMCPStatus } from "@/components/webmcp/webmcp-status";
import { WebMCPTools } from "@/components/webmcp/webmcp-tools";
import { CapturePile } from "@/components/zones/capture-pile";
import { DiscardPile } from "@/components/zones/discard-pile";
import { Hand } from "@/components/zones/hand";
import { PlayArea } from "@/components/zones/play-area";
import { StockPile } from "@/components/zones/stock-pile";
import {
  gameStore,
  getHumanView,
  tutorialCuePhase,
  useGameSession,
  type LegalAction,
  type SessionMode,
} from "@/lib/game";
import { AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

const HIGHLIGHT_CLASSES =
  "ring-2 ring-sky-400 shadow-[0_0_16px_4px_rgba(56,189,248,0.45)] animate-[highlight-pulse_2s_ease-in-out_infinite] relative";

export function GameTable({
  routeSessionId,
}: {
  routeSessionId?: string;
} = {}) {
  const session = useGameSession();
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [amountDraft, setAmountDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [botCardsRevealed, setBotCardsRevealed] = useState(false);

  const view = useMemo(
    () => (session ? getHumanView(session) : null),
    [session],
  );

  const highlight = view?.highlight ?? null;
  const cuePhase = tutorialCuePhase(
    highlight,
    view?.legalActions ?? [],
    selectedCardIds,
  );
  const cueCardId = highlight?.cardId;
  const zoneLabel =
    highlight?.label &&
    (cuePhase === "card" || !highlight.actionId)
      ? highlight.label
      : null;

  function isHighlighted(target: string, playerId?: string): boolean {
    if (!highlight) return false;
    // Target matches a player id directly (highlight the whole seat)
    if (highlight.target === playerId) return true;
    // Zone target matches
    if (highlight.target !== target) return false;
    // Zone targets that are seat-specific default to the human seat when no scope is given,
    // matching the highlight tool description. Otherwise the scope must match.
    const scopedZones = ["hand", "capture"];
    const expectedPlayerId = highlight.playerId ?? (scopedZones.includes(target) ? "human" : undefined);
    if (expectedPlayerId && playerId && expectedPlayerId !== playerId) return false;
    return true;
  }

  const human = view?.players.find((p) => p.id === "human");
  const bots = view?.players.filter((p) => p.kind === "bot") ?? [];
  const isPractice = session?.mode === "practice";
  const isTutorial = session?.mode === "tutorial";
  const isHumanTurn = view?.turnPlayerId === "human";
  const interactive = Boolean((isPractice || isTutorial) && isHumanTurn);

  function runSafe(fn: () => void) {
    try {
      setError(null);
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function handleModeChange(mode: string) {
    if (!session) return;
    runSafe(() => gameStore.setMode(mode as SessionMode));
  }

  function resolveAmount(action: LegalAction): number | undefined {
    if (!action.promptAmount) return action.amount;
    const raw = amountDraft[action.id];
    if (raw === undefined || raw === "") {
      throw new Error(`Enter an amount for ${action.label}`);
    }
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Invalid amount for ${action.label}`);
    }
    if (action.minAmount !== undefined && value < action.minAmount) {
      throw new Error(`Minimum amount is ${action.minAmount}`);
    }
    if (action.maxAmount !== undefined && value > action.maxAmount) {
      throw new Error(`Maximum amount is ${action.maxAmount}`);
    }
    return value;
  }

  function handleLegalAction(action: LegalAction) {
    if (!session || !interactive) return;
    runSafe(() => {
      gameStore.applyHumanLegalAction(action, {
        selectedCardIds,
        amount: resolveAmount(action),
      });
      if (
        action.primitive === "play" ||
        action.primitive === "discard" ||
        action.primitive === "capture" ||
        action.requiresCardSelection
      ) {
        setSelectedCardIds([]);
      }
      if (action.promptAmount) {
        setAmountDraft((prev) => {
          const next = { ...prev };
          delete next[action.id];
          return next;
        });
      }
    });
  }

  function toggleSelectedCard(cardId: string) {
    setSelectedCardIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId],
    );
  }

  return (
    <>
      <WebMCPTools />
      <SessionUrlSync routeSessionId={routeSessionId}>
        <div className="flex h-dvh min-h-0 flex-1 flex-col overflow-hidden bg-[#0b1f14] text-base text-emerald-50">

          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-900/50 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="inline-flex items-center gap-1.5 text-base font-semibold tracking-wide text-emerald-100">
                <MaterialIcon name="casino" size="sm" className="text-amber-400/90" />
                Playing cards simulator
              </h1>
              {session ? (
                <>
                  <Badge variant="secondary">{session.name}</Badge>
                  <Badge variant="outline">{session.phase}</Badge>
                  {view?.turnPlayerName && (
                    <Badge variant="muted">Turn · {view.turnPlayerName}</Badge>
                  )}
                </>
              ) : (
                <Badge variant="muted">No game</Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {session && (
                <ToggleGroup
                  value={session.mode}
                  onValueChange={handleModeChange}
                  options={[
                    { value: "practice", label: "Practice", icon: "sports_esports" },
                    { value: "tutorial", label: "Tutorial", icon: "school" },
                  ]}
                />
              )}
              <WebMCPStatus />
            </div>
          </header>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {session && view && (
              <TableSidebars
                logs={view.narration}
                instructions={view.instructions}
              />
            )}
            {!session || !view ? (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
                <GameCatalog
                  onStart={(id, mode) =>
                    runSafe(() => gameStore.startPreset(id, mode))
                  }
                />
              </div>
            ) : (
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-8 pt-8">
                {/* Bot seats */}
                <div className="flex flex-wrap justify-center gap-2.5">
                  {bots.map((bot) => (
                    <div
                      key={bot.id}
                      className={`relative flex min-w-[9rem] max-w-3xl flex-1 flex-col items-center gap-1.5 rounded-lg border border-emerald-900/45 bg-emerald-950/25 px-3 py-2 transition-shadow duration-300 ${bot.folded ? "opacity-40" : ""
                        } ${isHighlighted("hand", bot.id) || isHighlighted(bot.id) ? HIGHLIGHT_CLASSES : ""}`}
                    >
                      {(isHighlighted("hand", bot.id) || isHighlighted(bot.id)) && zoneLabel && (
                        <span className="absolute left-1/2 top-full z-20 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                          {zoneLabel}
                        </span>
                      )}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-emerald-100">{bot.name}</span>
                        {bot.chips !== null && <ChipAmount amount={bot.chips} />}
                        {session.mode === "tutorial" && bot.handCount > 0 && (
                          <button
                            type="button"
                            onClick={() => setBotCardsRevealed((v) => !v)}
                            className="inline-flex items-center justify-center rounded p-0.5 text-emerald-400/70 transition-colors hover:text-emerald-200"
                            aria-label={botCardsRevealed ? "Hide bot cards" : "Show bot cards"}
                          >
                            <MaterialIcon
                              name={botCardsRevealed ? "visibility_off" : "visibility"}
                              size="xs"
                            />
                          </button>
                        )}
                      </div>
                      <div className="flex min-w-0 flex-wrap justify-center gap-1">
                        {session.mode === "practice" || (session.mode === "tutorial" && !botCardsRevealed) ? (
                          bot.handCount > 0 && (
                            <div className="relative">
                              <PlayingCard
                                id={`${bot.id}-hidden-hand`}
                                faceUp={false}
                                size="sm"
                                noEnter
                              />
                              <span className="absolute -right-2 -top-2 rounded-full bg-emerald-400 px-1.5 py-0.5 text-xs font-semibold text-emerald-950">
                                {bot.handCount}
                              </span>
                            </div>
                          )
                        ) : (
                          <AnimatePresence initial={false}>
                            {bot.hand.map((c) => (
                              <PlayingCard
                                key={c.id}
                                id={c.id}
                                faceUp={c.faceUp}
                                rank={c.rank}
                                suit={c.suit}
                                size="sm"
                              />
                            ))}
                          </AnimatePresence>
                        )}
                      </div>
                      {session.enabledZones.capture && (
                        <CapturePile
                          cards={session.cards
                            .filter(
                              (c) =>
                                c.location.zone === "capture" &&
                                c.location.ownerId === bot.id,
                            )
                            .map((c) => ({
                              id: c.id,
                              faceUp: c.visibility === "public",
                              rank: c.visibility === "public" ? c.rank : undefined,
                              suit: c.visibility === "public" ? c.suit : undefined,
                            }))}
                          label="Score"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {/* Center table */}
                <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-emerald-900/40 bg-[radial-gradient(ellipse_at_center,#14532d_0%,#052e16_70%)] px-4 py-4 shadow-inner">
                  {view.chips && (
                    <div
                      className={`inline-flex items-center gap-2 rounded px-2 py-0.5 text-sm tabular-nums text-amber-200/90 transition-shadow duration-300 ${isHighlighted("pot") ? HIGHLIGHT_CLASSES : ""}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        <MaterialIcon
                          name="poker_chip"
                          size="sm"
                          filled
                          className="text-amber-400"
                        />
                        Pot · {view.chips.pot}
                      </span>
                      {view.chips.currentBet > 0 && (
                        <span className="text-amber-200/70">
                          Bet {view.chips.currentBet}
                        </span>
                      )}
                      {isHighlighted("pot") && zoneLabel && (
                        <span className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                          {zoneLabel}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-end justify-center gap-5">
                    {session.enabledZones.stock && (
                      <div className={`rounded-lg transition-shadow duration-300 ${isHighlighted("stock") ? HIGHLIGHT_CLASSES : ""}`}>
                        <StockPile count={view.stockCount} />
                        {isHighlighted("stock") && zoneLabel && (
                          <span className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                            {zoneLabel}
                          </span>
                        )}
                      </div>
                    )}
                    {session.enabledZones.play && (
                      <div className={`rounded-lg transition-shadow duration-300 ${isHighlighted("play") ? HIGHLIGHT_CLASSES : ""}`}>
                        <PlayArea
                          cards={view.play}
                          layout={
                            session.playLayout ??
                            (view.play.length > 1 && view.play.every((card) => !card.faceUp)
                              ? "stack"
                              : "spread")
                          }
                        />
                        {isHighlighted("play") && zoneLabel && (
                          <span className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                            {zoneLabel}
                          </span>
                        )}
                      </div>
                    )}
                    {session.enabledZones.discard && (
                      <div className={`rounded-lg transition-shadow duration-300 ${isHighlighted("discard") ? HIGHLIGHT_CLASSES : ""}`}>
                        <DiscardPile top={view.discardTop} count={view.discardCount} />
                        {isHighlighted("discard") && zoneLabel && (
                          <span className="absolute -bottom-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                            {zoneLabel}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Human seat */}
                <div
                  className={`relative mx-auto flex w-full max-w-3xl flex-col items-center gap-2 rounded-lg border border-emerald-900/45 bg-emerald-950/20 px-3 py-2.5 transition-shadow duration-300 ${
                    cuePhase === "card" && cueCardId
                      ? ""
                      : isHighlighted("hand", "human") ||
                          isHighlighted("human") ||
                          (cuePhase === "card" && !cueCardId)
                        ? HIGHLIGHT_CLASSES
                        : ""
                  }`}
                >
                  {(cuePhase === "card" ||
                    isHighlighted("hand", "human") ||
                    isHighlighted("human")) &&
                    zoneLabel && (
                    <span className="absolute -top-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                      {zoneLabel}
                    </span>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-emerald-100">You</span>
                    {human?.chips !== null && human?.chips !== undefined && (
                      <ChipAmount amount={human.chips} />
                    )}
                    {human?.folded && <Badge variant="muted">Folded</Badge>}
                  </div>
                  {session.enabledZones.hand && human && (
                    <Hand
                      cards={human.hand}
                      selectedIds={selectedCardIds}
                      highlightedIds={
                        cuePhase === "card" && cueCardId ? [cueCardId] : []
                      }
                      onSelect={toggleSelectedCard}
                      interactive={interactive}
                    />
                  )}
                  {session.enabledZones.capture && human && (
                    <CapturePile
                      cards={session.cards
                        .filter(
                          (c) =>
                            c.location.zone === "capture" &&
                            c.location.ownerId === "human",
                        )
                        .map((c) => ({
                          id: c.id,
                          faceUp: true,
                          rank: c.rank,
                          suit: c.suit,
                        }))}
                    />
                  )}
                </div>

                {/* Actions — driven entirely by agent-defined legalActions */}
                <div
                  className={`relative mx-auto flex w-full max-w-3xl flex-col gap-1.5 rounded-lg px-1 py-1 transition-shadow duration-300 ${isHighlighted("actions") && !highlight?.actionId && cuePhase !== "card" ? HIGHLIGHT_CLASSES : ""
                    }`}
                >
                  {isHighlighted("actions") && cuePhase !== "card" && zoneLabel && (
                    <span className="absolute -top-6 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                      {zoneLabel}
                    </span>
                  )}
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {view.legalActions.length > 0 ? (
                      view.legalActions.map((action) => {
                        const actionCue =
                          highlight?.actionId === action.id && cuePhase !== "card";
                        return (
                          <div
                            key={action.id}
                            className={`relative flex items-center gap-1.5 rounded-lg ${actionCue ? HIGHLIGHT_CLASSES : ""}`}
                          >
                            {actionCue && highlight?.label && (
                              <span className="absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white shadow-md">
                                {highlight.label}
                              </span>
                            )}
                            {action.promptAmount && (
                              <input
                                type="number"
                                inputMode="numeric"
                                disabled={!interactive}
                                placeholder={
                                  action.minAmount !== undefined
                                    ? `≥ ${action.minAmount}`
                                    : "Amount"
                                }
                                min={action.minAmount}
                                max={action.maxAmount}
                                value={amountDraft[action.id] ?? ""}
                                onChange={(e) =>
                                  setAmountDraft((prev) => ({
                                    ...prev,
                                    [action.id]: e.target.value,
                                  }))
                                }
                                className="h-8 w-20 rounded-md border border-emerald-700/60 bg-emerald-950/40 px-2 text-sm text-emerald-50 placeholder:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60"
                                aria-label={`Amount for ${action.label}`}
                              />
                            )}
                            <Button
                              size="sm"
                              variant={
                                action.chipAction === "fold" ||
                                  action.primitive === "fold"
                                  ? "destructive"
                                  : "default"
                              }
                              onClick={() => handleLegalAction(action)}
                            >
                              <MaterialIcon name={actionIcon(action)} size="xs" />
                              {action.label}
                            </Button>
                          </div>
                        );
                      })
                    ) : !isHumanTurn ? (
                      <p className="text-sm text-emerald-400/80">
                        Waiting for {view.turnPlayerName ?? "another player"}…
                      </p>
                    ) : (
                      <p className="max-w-sm text-center text-sm text-emerald-400/80">
                        No human controls in this phase.
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => runSafe(() => gameStore.clear())}
                    >
                      <MaterialIcon name="stop_circle" size="xs" />
                      End game
                    </Button>
                  </div>
                  {error && (
                    <p className="text-center text-sm text-red-400">{error}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </SessionUrlSync>
    </>
  );
}
