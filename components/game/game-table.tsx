"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CapturePile } from "@/components/zones/capture-pile";
import { DiscardPile } from "@/components/zones/discard-pile";
import { Hand } from "@/components/zones/hand";
import { PlayArea } from "@/components/zones/play-area";
import { StockPile } from "@/components/zones/stock-pile";
import { Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToggleGroup } from "@/components/ui/toggle-group";
import { GameCatalog } from "@/components/game/game-catalog";
import { TableSidebars } from "@/components/game/instructions-sidebar";
import { WebMCPStatus } from "@/components/webmcp/webmcp-status";
import { WebMCPTools } from "@/components/webmcp/webmcp-tools";
import {
  getHumanView,
  gameStore,
  useGameSession,
  type LegalAction,
  type SessionMode,
} from "@/lib/game";
import { PlayingCard } from "@/components/cards/playing-card";

const HIGHLIGHT_CLASSES =
  "ring-2 ring-sky-400 shadow-[0_0_16px_4px_rgba(56,189,248,0.45)] animate-[highlight-pulse_2s_ease-in-out_infinite] relative";

export function GameTable() {
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
    <div className="flex min-h-full flex-1 flex-col bg-[#0b1f14] text-base text-emerald-50">
      <WebMCPTools />

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/60 px-4 py-3 text-base">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-semibold tracking-wide text-emerald-100">
            Card Table
          </h1>
          {session ? (
            <>
              <motion.span
                key={`name-${session.name}`}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Badge variant="secondary">{session.name}</Badge>
              </motion.span>
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`phase-${session.phase}`}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                >
                  <Badge variant="outline">{session.phase}</Badge>
                </motion.span>
              </AnimatePresence>
              {view?.turnPlayerName && (
                <motion.span
                  key={`turn-${view.turnPlayerId}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 24 }}
                >
                  <Badge variant="muted">Turn · {view.turnPlayerName}</Badge>
                </motion.span>
              )}
            </>
          ) : (
            <Badge variant="muted">No game</Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {session && (
            <ToggleGroup
              value={session.mode}
              onValueChange={handleModeChange}
              options={[
                { value: "practice", label: "Practice" },
                { value: "tutorial", label: "Tutorial" },
              ]}
            />
          )}
          <WebMCPStatus />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
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
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 p-4">
          {/* Bot seats */}
          <div className="flex flex-wrap justify-center gap-4">
            <AnimatePresence initial={false}>
              {bots.map((bot) => (
                <motion.div
                  key={bot.id}
                  initial={{ opacity: 0, y: 16, scale: 0.95 }}
                  animate={{ opacity: bot.folded ? 0.4 : 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 240, damping: 24 }}
                  className={`flex min-w-[9rem] w-full max-w-3xl flex-col items-center gap-2 rounded-lg border border-emerald-900/50 bg-emerald-950/30 px-3 py-2 transition-shadow duration-300 ${
                    bot.folded ? "opacity-40" : ""
                  } ${isHighlighted("hand", bot.id) || isHighlighted(bot.id) ? HIGHLIGHT_CLASSES : view.turnPlayerId === bot.id ? "ring-1 ring-amber-400/60" : ""}`}
                >
                  {(isHighlighted("hand", bot.id) || isHighlighted(bot.id)) && highlight?.label && (
                    <motion.span
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white z-10">{highlight.label}</motion.span>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-emerald-100">{bot.name}</span>
                    {bot.chips !== null && (
                      <span className="text-amber-300/90">{bot.chips}</span>
                    )}
                    {session.mode === "tutorial" && bot.handCount > 0 && (
                      <button
                        type="button"
                        onClick={() => setBotCardsRevealed((v) => !v)}
                        className="inline-flex items-center justify-center rounded p-0.5 text-emerald-400/70 hover:text-emerald-200 transition-colors"
                        aria-label={botCardsRevealed ? "Hide bot cards" : "Show bot cards"}
                      >
                        {botCardsRevealed ? (
                          <EyeOff className="size-3.5" />
                        ) : (
                          <Eye className="size-3.5" />
                        )}
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Center table */}
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-900/40 bg-[radial-gradient(ellipse_at_center,#14532d_0%,#052e16_70%)] px-4 py-8 shadow-inner">
            {view.chips && (
              <div className={`text-sm text-amber-200/90 rounded px-2 py-1 transition-shadow duration-300 ${isHighlighted("pot") ? HIGHLIGHT_CLASSES : ""}`}>
                Pot · {view.chips.pot}
                {view.chips.currentBet > 0
                  ? ` · Bet ${view.chips.currentBet}`
                  : ""}
                {isHighlighted("pot") && highlight?.label && (
                  <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white">{highlight.label}</span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-end justify-center gap-6">
              {session.enabledZones.stock && (
                <div className={`rounded-lg p-1 transition-shadow duration-300 ${isHighlighted("stock") ? HIGHLIGHT_CLASSES : ""}`}>
                  <StockPile count={view.stockCount} />
                  {isHighlighted("stock") && highlight?.label && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white">{highlight.label}</span>
                  )}
                </div>
              )}
              {session.enabledZones.play && (
                <div className={`rounded-lg p-1 transition-shadow duration-300 ${isHighlighted("play") ? HIGHLIGHT_CLASSES : ""}`}>
                  <PlayArea
                    cards={view.play}
                    layout={
                      session.playLayout ??
                      (view.play.length > 1 && view.play.every((card) => !card.faceUp)
                        ? "stack"
                        : "spread")
                    }
                  />
                  {isHighlighted("play") && highlight?.label && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white">{highlight.label}</span>
                  )}
                </div>
              )}
              {session.enabledZones.discard && (
                <div className={`rounded-lg p-1 transition-shadow duration-300 ${isHighlighted("discard") ? HIGHLIGHT_CLASSES : ""}`}>
                  <DiscardPile top={view.discardTop} count={view.discardCount} />
                  {isHighlighted("discard") && highlight?.label && (
                    <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white">{highlight.label}</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Human seat */}
          <div
            className={`mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3 transition-shadow duration-300 ${
              isHighlighted("hand", "human") || isHighlighted("human") ? HIGHLIGHT_CLASSES : view.turnPlayerId === "human" ? "ring-1 ring-amber-400/60" : ""
            }`}
          >
            {(isHighlighted("hand", "human") || isHighlighted("human")) && highlight?.label && (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white z-10">{highlight.label}</span>
            )}
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">You</span>
              {human?.chips !== null && human?.chips !== undefined && (
                <span className="text-amber-300/90">{human.chips} chips</span>
              )}
              {human?.folded && <Badge variant="muted">Folded</Badge>}
            </div>
            {session.enabledZones.hand && human && (
              <Hand
                cards={human.hand}
                selectedIds={selectedCardIds}
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
          <div className={`mx-auto flex w-full max-w-3xl flex-col gap-2 rounded-lg p-2 transition-shadow duration-300 ${isHighlighted("actions") ? HIGHLIGHT_CLASSES : ""}`}>
            {isHighlighted("actions") && highlight?.label && (
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-sky-500/90 px-2 py-0.5 text-xs font-medium text-white">{highlight.label}</span>
            )}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {view.legalActions.length > 0 ? (
                <AnimatePresence initial={false}>
                  {view.legalActions.map((action) => (
                    <motion.div
                      key={action.id}
                      initial={{ opacity: 0, y: 10, scale: 0.92 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.92 }}
                      transition={{ type: "spring", stiffness: 300, damping: 24 }}
                      className="flex items-center gap-1.5"
                    >
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
                        {action.label}
                      </Button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : !isHumanTurn ? (
                <p className="text-sm text-emerald-400/80">
                  Waiting for {view.turnPlayerName ?? "another player"}…
                </p>
              ) : (
                <p className="text-sm text-emerald-400/80">
                  No human controls in this phase. Ask the agent to explain the
                  game state, or start a new hand when a control appears.
                </p>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => runSafe(() => gameStore.clear())}
              >
                End game
              </Button>
            </div>
            {error && (
              <motion.p
                key={error}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: [0, -6, 6, -4, 4, 0] }}
                transition={{ duration: 0.4 }}
                className="text-center text-sm text-red-400"
              >
                {error}
              </motion.p>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
