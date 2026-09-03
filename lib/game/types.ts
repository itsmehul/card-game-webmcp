export type Suit = "spades" | "hearts" | "diamonds" | "clubs" | "none";

export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "joker";

export type ZoneKind = "stock" | "hand" | "play" | "discard" | "capture";

export type Visibility = "hidden" | "public" | "unknown";

export type PlayerKind = "human" | "bot";

export type SessionMode = "tutorial" | "practice";

export type TurnDirection = "clockwise" | "counterclockwise";

export type ChipActionKind = "fold" | "check" | "call" | "bet" | "raise";

/** What happens when the human clicks a control in practice mode. */
export type ActionPrimitive =
  | "draw"
  | "deal_all"
  | "deal_spec"
  | "play"
  | "play_all"
  | "discard"
  | "capture"
  | "transfer"
  | "sweep"
  | "collect_sets"
  | "pass"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise"
  | "all_in";

/**
 * Seat selector used by deal/transfer/sweep specs.
 * Accepts a player id, or one of the symbolic targets below.
 */
export type SeatTarget =
  | "each"
  | "others"
  | "current"
  | "human"
  | "winner"
  | "play"
  | (string & {});

/** One line of a per-seat deal (Blackjack dealer up-card, uneven openings). */
export interface DealSpec {
  target: SeatTarget;
  count: number;
  visibility?: Visibility;
}

/** Move cards between seats/zones (Go Fish ask, stealing, passing). */
export interface TransferSpec {
  from: SeatTarget;
  to: SeatTarget;
  fromZone?: ZoneKind;
  toZone?: ZoneKind;
  /** Take every card of this rank (the Go Fish "ask") */
  rank?: Rank;
  /** Ask for the rank of the card the human selected, rather than a fixed rank */
  rankFromSelection?: boolean;
  /** Explicit card ids; wins over rank/count */
  cardIds?: string[];
  /** Take up to N cards when rank/cardIds are omitted */
  count?: number;
  visibility?: Visibility;
  /** Do not throw when the source holds nothing matching */
  allowEmpty?: boolean;
}

/** Award a whole zone to a seat (War trick, trick-taking). */
export interface SweepSpec {
  fromZone?: ZoneKind;
  to: SeatTarget;
  toZone?: ZoneKind;
  visibility?: Visibility;
}

/** Configurable hand scoring so totals are not hard-coded per game. */
export interface HandScoring {
  /** Explicit per-rank values; unlisted ranks use pip value, face = 10 */
  values?: Partial<Record<Rank, number>>;
  /** Alternate (soft) ace value used while it does not bust */
  aceAlt?: number;
  /** Score above this counts as bust */
  bustOver?: number;
  zone?: ZoneKind;
}

export type ConditionSubject =
  | "always"
  | "hand_count"
  | "hand_score"
  | "hand_busted"
  | "stock_count"
  | "capture_count"
  | "zone_count"
  | "chips";

export type ConditionOp = "lt" | "lte" | "eq" | "neq" | "gte" | "gt";

/** Predicate evaluated against live state to pick a branch. */
export interface Condition {
  subject: ConditionSubject;
  playerId?: SeatTarget;
  zone?: ZoneKind;
  op?: ConditionOp;
  value?: number;
  scoring?: HandScoring;
}

/** Conditional follow-up applied after a control's primitive runs. */
export interface ActionBranch {
  when: Condition;
  nextPhase?: string;
  nextActions?: LegalAction[];
  narration?: string;
  rotateTurn?: boolean;
  turnTarget?: SeatTarget | "next" | "previous" | "same" | "first";
}

export interface CardLocation {
  zone: ZoneKind;
  /** Required for hand and capture piles */
  ownerId?: string;
}

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  location: CardLocation;
  visibility: Visibility;
}

export interface Player {
  id: string;
  name: string;
  kind: PlayerKind;
  folded: boolean;
}

/**
 * Agent-defined human control. Rendered as a button (and optional amount
 * field) in practice mode. Declare effects here — do not rely on UI
 * special-cases for a particular game.
 */
export interface LegalAction {
  id: string;
  label: string;
  /**
   * XState event type fired when the human clicks this control.
   * When set, the store sends the event to the game machine instead of
   * running applyHumanLegalAction primitives.
   */
  event?: string;
  /** Optional chip action kind when this maps to betting */
  chipAction?: ChipActionKind;
  /** Fixed chip/card amount when not prompting the human */
  amount?: number;
  /** Show a number input so the human picks the bet/raise size */
  promptAmount?: boolean;
  minAmount?: number;
  maxAmount?: number;
  /** Engine primitive to run for the human seat */
  primitive?: ActionPrimitive;
  /** Cards to draw/deal (default 1) */
  count?: number;
  visibility?: Visibility;
  /** Require one or more selected hand cards (play/discard/capture) */
  requiresCardSelection?: boolean;
  /** Phase label after the click */
  nextPhase?: string;
  /** Replace the control set after the click (omit to leave unchanged; [] to clear) */
  nextActions?: LegalAction[];
  /** Pass the turn after the click */
  rotateTurn?: boolean;
  /** Give the turn to a specific seat (wins over rotateTurn) */
  turnTarget?: SeatTarget | "next" | "previous" | "same" | "first";
  /** Student-facing narration written on click */
  narration?: string;
  /** Per-seat deal lines for the deal_spec primitive */
  dealSpec?: DealSpec[];
  /** Card movement for the transfer primitive */
  transfer?: TransferSpec;
  /** Zone award for the sweep primitive */
  sweep?: SweepSpec;
  /** Cards per set for the collect_sets primitive (2 = pairs, 4 = books) */
  setSize?: number;
  /** Scoring rules used by conditions and score readouts */
  scoring?: HandScoring;
  /**
   * Conditional follow-ups evaluated in order after the primitive runs.
   * The first match wins and overrides nextPhase/nextActions/turn.
   */
  branches?: ActionBranch[];
}

export interface ChipLedger {
  stacks: Record<string, number>;
  pot: number;
  currentBet: number;
  /** Amount each player has put in this betting round */
  contributions: Record<string, number>;
  /** Cumulative amount each player has put in this hand (drives side pots) */
  committed: Record<string, number>;
}

/** One main/side pot with the seats eligible to win it. */
export interface Pot {
  amount: number;
  eligible: string[];
}

export interface EnabledZones {
  stock: boolean;
  hand: boolean;
  play: boolean;
  discard: boolean;
  capture: boolean;
}

/** How cards in the shared play zone are presented. */
export type PlayLayout = "spread" | "stack";

/** Element the agent wants to visually highlight for the student.
 * Use a zone id (stock/hand/play/discard/capture/actions/pot) or a player id
 * (human, bot_1, …) to highlight a whole seat. For zone targets, pair with
 * playerId to scope the highlight to a specific seat's zone.
 */
export type HighlightTarget =
  | "stock"
  | "hand"
  | "play"
  | "discard"
  | "capture"
  | "actions"
  | "pot"
  | (string & {}); // also accepts a player id like "human", "bot_1"

export interface Highlight {
  /** Which UI element or seat to glow. */
  target: HighlightTarget;
  /** Optional player scope for zone targets (e.g. highlight bot_1's hand rather than the current player's). Defaults to the current turn holder for hand/capture. */
  playerId?: string;
  /** Optional short label shown near the highlight. */
  label?: string;
  /** When set, glow this legal-action button; the label renders on that control (click cue). */
  actionId?: string;
}

export interface NarrationEntry {
  id: string;
  text: string;
  at: number;
}

export interface GameSession {
  id: string;
  name: string;
  jokers: boolean;
  enabledZones: EnabledZones;
  playLayout: PlayLayout;
  players: Player[];
  turnIndex: number;
  turnDirection: TurnDirection;
  mode: SessionMode;
  phase: string;
  legalActions: LegalAction[];
  cards: Card[];
  chips: ChipLedger | null;
  narration: NarrationEntry[];
  /** Student-facing how-to text; written by the agent. */
  instructions: string;
  /** Active tutorial highlight; null when nothing is highlighted. */
  highlight: Highlight | null;
  startedAt: number;
}

export interface CreateGameOptions {
  /** Display name. Optional when `preset` is set (the catalog name is used). */
  name?: string;
  botCount?: number;
  jokers?: boolean;
  mode?: SessionMode;
  turnDirection?: TurnDirection;
  enabledZones?: Partial<EnabledZones>;
  /** Present shared play cards as individual cards or one layered pile. */
  playLayout?: PlayLayout;
  chips?: boolean;
  startingStack?: number;
  /** Catalog preset id (e.g. texas-holdem, blackjack). Omit for a custom game. */
  preset?: string;
  /**
   * @deprecated Prefer `machine` meta.controls. Ignored when a machine is used.
   */
  legalActions?: LegalAction[];
  /**
   * XState machine config (JSON-serializable). Required for custom games.
   * Catalog presets supply this via their JSON files.
   */
  machine?: import("./machine/types").GameMachineConfig;
  /** @deprecated Prefer machine.initial */
  phase?: string;
  /** Student-facing how-to; shown in the instructions sidebar */
  instructions?: string;
}

export interface CardPublicView {
  id: string;
  faceUp: boolean;
  rank?: Rank;
  suit?: Suit;
}

/** Outcome of awaiting a human legal-action click during a tutorial. */
export interface AwaitUserActionResult {
  /** True when the wait expired before any click was received. */
  timedOut: boolean;
  /** True when the await was cancelled by a new game / clear. */
  cancelled?: boolean;
  /** The action id the human clicked (absent on timeout / cancel). */
  actionId?: string;
  /** The clicked action's label (absent on timeout / cancel). */
  label?: string;
  /** True when expectActionId was omitted or matched the clicked action. */
  matched?: boolean;
  /** Card ids the human had selected when they clicked (absent on timeout / cancel). */
  selectedCardIds?: string[];
  /** Amount the human entered for a promptAmount action (absent on timeout / cancel). */
  amount?: number;
}

export interface AwaitUserActionOptions {
  /** Only this action id resolves the await; others resolve with matched:false. */
  expectActionId?: string;
  /** Max wait in ms. On expiry resolves with { timedOut: true }. */
  timeoutMs?: number;
  /** When aborted (host cancelled the tool call), resolve with { timedOut: true }. */
  signal?: AbortSignal;
}

export interface HumanGameView {
  name: string;
  mode: SessionMode;
  phase: string;
  turnPlayerId: string | null;
  turnPlayerName: string | null;
  legalActions: LegalAction[];
  players: Array<{
    id: string;
    name: string;
    kind: PlayerKind;
    folded: boolean;
    handCount: number;
    captureCount: number;
    chips: number | null;
    hand: CardPublicView[];
  }>;
  stockCount: number;
  discardTop: CardPublicView | null;
  discardCount: number;
  play: CardPublicView[];
  narration: NarrationEntry[];
  instructions: string;
  highlight: Highlight | null;
  chips: ChipLedger | null;
}
