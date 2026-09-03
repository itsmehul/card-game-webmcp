---
name: card-table-reference
---

# XState machine JSON for custom games

Pass a `machine` object to `create_game` (required when inventing a game). Catalog presets already ship machines.

## Shape

```json
{
  "id": "my-game",
  "initial": "waiting_to_deal",
  "states": {
    "waiting_to_deal": {
      "meta": {
        "controls": [
          { "id": "deal", "label": "Deal", "event": "DEAL", "primitive": "deal_spec" }
        ]
      },
      "on": {
        "DEAL": {
          "target": "your_turn",
          "actions": [
            { "type": "dealSpec", "params": { "dealSpec": [{ "target": "each", "count": 5, "visibility": "hidden" }] } },
            { "type": "narrate", "params": { "text": "Dealt." } }
          ]
        }
      }
    },
    "your_turn": {
      "meta": {
        "controls": [
          { "id": "hit", "label": "Hit", "event": "HIT", "primitive": "draw" }
        ]
      },
      "on": {
        "HIT": { "target": "after_hit", "actions": ["drawHuman"] }
      }
    },
    "after_hit": {
      "always": [
        { "guard": { "type": "handBusted", "params": { "bustOver": 21 } }, "target": "done" },
        { "target": "your_turn" }
      ]
    },
    "done": { "type": "final", "meta": { "controls": [] } }
  }
}
```

## Controls (`meta.controls`)

Each control needs `id`, `label`, `event`. Optional: `primitive`, `chipAction`, `amount`, `promptAmount`, `minAmount`, `maxAmount`, `requiresCardSelection`, `count`, `setSize`.

Human clicks send `{ type: event, selectedCardIds?, amount? }` to the machine.

## Named actions (registry)

`narrate`, `dealSpec`, `dealAll`, `dealToPlay`, `drawHuman`, `drawSeat`, `playHuman`, `discardHuman`, `playAll`, `transferAsk`, `sweepPlayToWinner`, `collectBooksHuman`, `chipBet` / `chipCall` / `chipCheck` / `chipRaise` / `chipFold` / `chipAllIn`, `postBlindsDefault`, `resetBetting`, `resetHand`, `rotateTurn`, `setTurn`, `revealDealerHole`, `dealerHitTo17`, `settleBlackjack`, `resolveWarIfDecisive`, `holdemBotsAct`, `holdemShowdown`, `awardToFoldWinner`, `botsUntilHuman`, `botCrazyEightsTurn`, `dealStarterDiscard`, `botSimplePlayOrDraw`, `botBullshitPlay`, `euchreBotsPlayTrick`, `sweepTrickToWinner`.

## Named guards

`handBusted`, `handScoreEq`, `handScoreGte`, `zoneCountEq`, `stockEmpty`, `warIsTie`, `warHasWinner`, `playEmpty`, `humanHandEmpty`, `askTargetHasRank`, `isHumanTurn`, `isBotTurn`, `onlyOneActive`, `boardCountEq`, `humanHasBooks`, `condition`.

Put settlement and phase changes in the machine — agents only have `create_game` / `get_game_state` / `narrate` / `set_instructions` / `highlight` / `await_user_action`.
