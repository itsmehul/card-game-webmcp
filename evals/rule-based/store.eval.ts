/**
 * Tutorial await / click-ack races in gameStore.
 */

import { afterEach, describe, expect, it } from "vitest";
import { gameStore } from "@/lib/game/store";
import { pass, fail, runEvals, type EvalResult } from "../helpers";

afterEach(() => {
  gameStore.clear();
});

describe("tutorial await_user_action", () => {
  it("replays a click that arrived before await (nextActions gap)", async () => {
    gameStore.createGame({ preset: "blackjack", mode: "tutorial" });
    const bet = gameStore.getSnapshot()!.legalActions[0];
    gameStore.applyHumanLegalAction(bet);

    const result = await gameStore.awaitUserAction({ expectActionId: "bet" });
    const results: EvalResult[] = [
      result.actionId === "bet" && result.matched
        ? pass("click_before_await")
        : fail(
            "click_before_await",
            `expected bet/matched, got ${JSON.stringify(result)}`,
          ),
    ];
    gameStore.ackUserAction();

    const timed = await gameStore.awaitUserAction({ timeoutMs: 30 });
    results.push(
      timed.timedOut
        ? pass("acked_click_not_replayed")
        : fail("acked_click_not_replayed", "acked bet was delivered twice"),
    );

    const summary = runEvals(results);
    expect(summary.failed, JSON.stringify(summary.results.filter((r) => r.status === "FAIL"))).toBe(0);
  });

  it("replays a click when the consumer never acked (host abort after Bet)", async () => {
    gameStore.createGame({ preset: "blackjack", mode: "tutorial" });
    const bet = gameStore.getSnapshot()!.legalActions[0];
    const pending = gameStore.awaitUserAction({ expectActionId: "bet" });
    gameStore.applyHumanLegalAction(bet);
    const first = await pending;
    expect(first.actionId).toBe("bet");

    const replay = await gameStore.awaitUserAction({ expectActionId: "deal" });
    const results: EvalResult[] = [
      replay.actionId === "bet" && replay.matched === false
        ? pass("unacked_click_replayed")
        : fail(
            "unacked_click_replayed",
            `expected unacked bet with matched:false, got ${JSON.stringify(replay)}`,
          ),
    ];
    gameStore.ackUserAction();

    const timed = await gameStore.awaitUserAction({
      expectActionId: "deal",
      timeoutMs: 30,
    });
    results.push(
      timed.timedOut
        ? pass("ack_stops_replay")
        : fail("ack_stops_replay", "click still replayed after ack"),
    );

    const summary = runEvals(results);
    expect(summary.failed, JSON.stringify(summary.results.filter((r) => r.status === "FAIL"))).toBe(0);
  });

  it("resolves timedOut when the AbortSignal fires while waiting", async () => {
    gameStore.createGame({ preset: "blackjack", mode: "tutorial" });
    const controller = new AbortController();
    const pending = gameStore.awaitUserAction({
      expectActionId: "bet",
      signal: controller.signal,
    });
    controller.abort();
    const result = await pending;
    const results: EvalResult[] = [
      result.timedOut
        ? pass("abort_signal_timeout")
        : fail("abort_signal_timeout", `expected timedOut, got ${JSON.stringify(result)}`),
    ];
    const summary = runEvals(results);
    expect(summary.failed).toBe(0);
  });

  it("does not swallow Bet when abort fires after the click resolved", async () => {
    gameStore.createGame({ preset: "blackjack", mode: "tutorial" });
    const controller = new AbortController();
    const bet = gameStore.getSnapshot()!.legalActions[0];
    const pending = gameStore.awaitUserAction({
      expectActionId: "bet",
      signal: controller.signal,
    });
    gameStore.applyHumanLegalAction(bet);
    const first = await pending;
    expect(first.actionId).toBe("bet");
    controller.abort();
    // Tool execute would skip ack when signal.aborted

    const replay = await gameStore.awaitUserAction({ expectActionId: "bet" });
    expect(replay.actionId).toBe("bet");
    expect(replay.matched).toBe(true);
    const results: EvalResult[] = [
      replay.actionId === "bet"
        ? pass("abort_after_click_replays")
        : fail("abort_after_click_replays", JSON.stringify(replay)),
    ];
    expect(runEvals(results).failed).toBe(0);
  });
});
