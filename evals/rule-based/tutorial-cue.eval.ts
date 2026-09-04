import { describe, expect, it } from "vitest";
import {
  tutorialCuePhase,
  type Highlight,
  type LegalAction,
} from "@/lib/game";
import { fail, pass, runEvals, type EvalResult } from "../helpers";

const play: LegalAction = {
  id: "play_card",
  label: "Play card",
  event: "PLAY",
  requiresCardSelection: true,
  primitive: "play",
};

const deal: LegalAction = {
  id: "deal",
  label: "Deal hands",
  event: "DEAL",
  primitive: "deal_spec",
};

const playCue: Highlight = {
  target: "actions",
  actionId: "play_card",
  label: "Play card",
  cardId: "2_clubs",
};

describe("tutorialCuePhase", () => {
  it("cues the card before the play button until a card is selected", () => {
    const results: EvalResult[] = [
      tutorialCuePhase(playCue, [play], []) === "card"
        ? pass("card_before_button")
        : fail("card_before_button", String(tutorialCuePhase(playCue, [play], []))),
      tutorialCuePhase(playCue, [play], ["2_clubs"]) === "action"
        ? pass("button_after_select")
        : fail(
            "button_after_select",
            String(tutorialCuePhase(playCue, [play], ["2_clubs"])),
          ),
      tutorialCuePhase({ target: "actions", actionId: "deal" }, [deal], []) ===
      "action"
        ? pass("deal_skips_card_phase")
        : fail("deal_skips_card_phase", "deal should cue the button immediately"),
    ];
    expect(runEvals(results).failed).toBe(0);
  });
});
