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
  | "play"
  | "discard"
  | "capture"
  | "pass"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise";

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
  /** Require a selected hand card (play/discard/capture) */
  requiresCardSelection?: boolean;
  /** Phase label after the click */
  nextPhase?: string;
  /** Replace the control set after the click (omit to leave unchanged; [] to clear) */
  nextActions?: LegalAction[];
  /** Pass the turn after the click */
  rotateTurn?: boolean;
  /** Student-facing narration written on click */
  narration?: string;
}

export interface ChipLedger {
  stacks: Record<string, number>;
  pot: number;
  currentBet: number;
  /** Amount each player has put in this betting round */
  contributions: Record<string, number>;
}

export interface EnabledZones {
  stock: boolean;
  hand: boolean;
  play: boolean;
  discard: boolean;
  capture: boolean;
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
  players: Player[];
  turnIndex: number;
  turnDirection: TurnDirection;
  mode: SessionMode;
  phase: string;
  legalActions: LegalAction[];
  cards: Card[];
  chips: ChipLedger | null;
  narration: NarrationEntry[];
  startedAt: number;
}

export interface CreateGameOptions {
  name: string;
  botCount?: number;
  jokers?: boolean;
  mode?: SessionMode;
  turnDirection?: TurnDirection;
  enabledZones?: Partial<EnabledZones>;
  chips?: boolean;
  startingStack?: number;
  preset?: "texas-holdem";
  /**
   * Initial human controls for practice mode. Required for non-preset
   * games when the human must act — define buttons matching the game's
   * first decision point (Hit/Stand, Deal, Fold/Check/Bet, etc.).
   */
  legalActions?: LegalAction[];
  /** Starting phase label (default waiting_to_deal) */
  phase?: string;
}

export interface CardPublicView {
  id: string;
  faceUp: boolean;
  rank?: Rank;
  suit?: Suit;
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
  chips: ChipLedger | null;
}
