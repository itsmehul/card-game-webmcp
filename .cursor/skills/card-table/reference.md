---
name: card-table-reference
---

# legalActions and custom games

Each control needs `id`, `label`, and a `primitive` (or `chipAction`). Optional: `nextPhase`, `nextActions`, `rotateTurn`, `turnTarget`, `narration`, `count`, `visibility`, `requiresCardSelection`, `promptAmount`, `dealSpec`, `transfer`, `sweep`, `setSize`, `scoring`, `branches`.

Primitives: `draw`, `deal_all`, `deal_spec`, `play`, `play_all`, `discard`, `capture`, `transfer`, `sweep`, `collect_sets`, `pass`, `fold`, `check`, `call`, `bet`, `raise`, `all_in`.

`turnTarget` wins over `rotateTurn`: `next`, `previous`, `same`, `first`, or a player id.

`branches`: first matching `when` wins. Subjects: `always`, `hand_count`, `hand_score`, `hand_busted`, `stock_count`, `capture_count`, `zone_count`, `chips`. Compare with `op` + `value`.

Blackjack deal_spec: human 2 hidden; dealer 1 public + 1 unknown. Hit branches: `hand_busted` then `hand_score` eq 21, else `always`.

`create_game` / `set_legal_actions` examples:

```json
[{"id":"hit","label":"Hit","primitive":"draw"},{"id":"stand","label":"Stand","primitive":"pass","nextPhase":"dealer_act","nextActions":[]}]
```
