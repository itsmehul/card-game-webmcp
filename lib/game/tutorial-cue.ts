import type { Highlight, LegalAction } from "./types";

export type TutorialCuePhase = "card" | "action" | null;

export function actionNeedsCardSelection(
  action: LegalAction | undefined,
): boolean {
  if (!action) return false;
  return Boolean(
    action.requiresCardSelection ||
      action.primitive === "play" ||
      action.primitive === "discard" ||
      action.primitive === "capture",
  );
}

/** Card-select actions glow the card first; the button lights after a pick. */
export function tutorialCuePhase(
  highlight: Highlight | null,
  legalActions: LegalAction[],
  selectedCardIds: string[],
): TutorialCuePhase {
  if (!highlight?.actionId) return null;
  const action = legalActions.find((a) => a.id === highlight.actionId);
  if (actionNeedsCardSelection(action) && selectedCardIds.length === 0) {
    return "card";
  }
  return "action";
}
