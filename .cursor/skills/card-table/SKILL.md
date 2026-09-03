---
name: card-table
description: >-
  Routes Card Table WebMCP tools for catalog and custom card games (Texas Hold'em,
  Blackjack, War, Go Fish). Use when playing, teaching, dealing, betting, or
  inventing a game on this table; when calling list_presets, create_game,
  get_game_state, legalActions, or any user-webmcp-local-relay card tool.
---

# Card Table tools

Tool schemas stay on the MCP server. This file is the playbook: **which tool, when**. Do not paste it into narration. Fetch `/skills/card-table/reference.md` only when writing `legalActions` or a custom game.

Seats: `human`, `bot_1`… or `each` / `others` / `current` / `winner`. Zones: `stock`, `hand`, `play`, `discard`, `capture`.

## Discover tools

Host names are **suffixed** (`list_presets_bb8b`, not `list_presets`). Looking up the bare name fails.

1. `GetDynamicTools` on `user-webmcp-local-relay` with **pattern** `list_presets` (or `create_game`, `deal`, …).
2. Call the matching suffixed name. If two suffixes exist, use the source with the latest `lastSeenAt` (`webmcp_list_sources`).
3. Do not call `GetDynamicTools` with `toolName` set to the unsuffixed playbook name.

## Start

1. `list_presets` before inventing a game.
2. Catalog → `create_game` with `preset` (name optional; the preset supplies it). Custom → omit `preset`; pass `name`, zones, `legalActions`, `instructions`.
3. Practice: human clicks buttons; never `apply_move` for `human`. Tutorial: agent may move any seat.
4. Mutating tools return compact agent state (in-play cards only, `stockCount`, last 3 narration lines). Use that result for the next decision — do **not** call `get_game_state` again unless the previous payload was lost.

## Router

| Intent | Tool |
| --- | --- |
| Compact state (if mutate result lost) | `get_game_state` |
| Human buttons / next decision | `set_legal_actions` |
| Sidebar how-to | `set_instructions` |
| Student log | `narrate` (short) |
| Phase label | `set_phase` |
| Whose turn | `set_turn` (`next` / `previous` / `same` / `first` / id) or `rotate_turn` |
| New deck | `shuffle` |
| One-seat deal / community | `deal` (`playerId: play` for tableau) |
| Uneven / mixed-visibility deal | `deal_batch` |
| Hit / draw | `draw` |
| Hand → play | `play` |
| Simultaneous flip (War) | `play_all` |
| Hand → discard | `discard` |
| Into score pile | `capture` |
| Flip visibility | `reveal` |
| Ask for a rank (Go Fish) | `transfer_cards` (`rank` or `rankFromSelection`; empty + `allowEmpty: false` = go fish) |
| Books / pairs | `collect_sets` (`size` 4 or 2) |
| Who wins a zone | `compare_zone` then `sweep_zone` (`to: winner` errors on a tie) |
| Hand total | `score_hand` (Blackjack: `scoring: { aceAlt: 11, bustOver: 21 }`) |
| Forced bets | `post_blinds` |
| Bot bet | `chip_action` or `apply_move` chip primitive |
| Side pots | `get_pots` then `award_pot` |
| Off-pot chips | `award_chips` |
| Between streets / new hand | `reset_round` (`betting` vs `hand`) |
| Generic bot primitive | `apply_move` (not for `human` in practice) |

Prefer the named tool over `apply_move` when both exist (`draw`, `play`, `transfer_cards`, …).

## Catalog follow-through

- **Hold'em**: `post_blinds` → deal holes → bot `chip_action` → flop/turn/river via `deal` to `play` → `reset_round` betting → showdown `get_pots` / `award_pot`.
- **Blackjack**: after stand/bust, `score_hand` dealer, hit dealer to 17, `award_chips`.
- **War**: `play_all` → `compare_zone` → `sweep_zone`; on tie, more `play_all` then sweep.
- **Go Fish**: `transfer_cards` from the asked bot; on error, `draw` and pass turn; `collect_sets` size 4.

## Rules

- Do not recreate a preset that `list_presets` already lists.
- Refresh `legalActions` whenever the legal decision changes.
- Keep `narrate` educational and short; do not dump JSON state.
