import type { MaterialIconName } from "@/components/ui/material-icon";
import type { LegalAction } from "@/lib/game";

/** Map legal actions to Material Symbols for action buttons. */
export function actionIcon(action: LegalAction): MaterialIconName {
  if (action.chipAction) {
    switch (action.chipAction) {
      case "bet":
        return "poker_chip";
      case "call":
        return "call_made";
      case "check":
        return "check";
      case "raise":
        return "north";
      case "fold":
        return "block";
    }
  }

  switch (action.primitive) {
    case "bet":
    case "raise":
      return "poker_chip";
    case "call":
      return "call_made";
    case "check":
      return "check";
    case "fold":
      return "block";
    case "all_in":
      return "all_inclusive";
    case "draw":
      return "add_card";
    case "deal_spec":
    case "deal_all":
      return "playing_cards";
    case "play":
    case "play_all":
      return "play_arrow";
    case "discard":
      return "south";
    case "capture":
      return "back_hand";
    case "transfer":
      return "swap_horiz";
    case "sweep":
      return "cleaning_services";
    case "collect_sets":
      return "collections_bookmark";
    case "pass":
      return "skip_next";
    default:
      return "touch_app";
  }
}
