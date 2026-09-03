---
name: card-table
description: >-
  Routes Card Table WebMCP tools for catalog and custom card games (Texas Hold'em,
  Blackjack, War, Go Fish, Crazy Eights, Euchre, Gin Rummy, Bullshit). Use when
  playing, teaching, dealing, betting, or inventing a game on this table; when
  calling list_presets, create_game, get_game_state, legalActions, or any
  user-webmcp-local-relay card tool.
---

# Card Table tools

Tool schemas stay on the MCP server. This file is the playbook: **which tool, when**. Do not paste it into narration. Fetch `skills://card-table/reference.md` (WebMCP resource) only when writing a custom XState `machine` for `create_game`.

Seats: `human`, `bot_1`… Zones: `stock`, `hand`, `play`, `discard`, `capture`.

## Discover tools

Host names are **suffixed** (`list_presets_bb8b`, not `list_presets`). Looking up the bare name fails.

1. `GetDynamicTools` on `user-webmcp-local-relay` with **pattern** `list_presets` (or `create_game`, `get_game_state`, …).
2. Call the matching suffixed name. If two suffixes exist, use the source with the latest `lastSeenAt` (`webmcp_list_sources`).
3. Do not call `GetDynamicTools` with `toolName` set to the unsuffixed playbook name.

## Start

1. `list_presets` before inventing a game.
2. Catalog → `create_game` with `preset` (name optional). Custom → omit `preset`; pass `name` + XState-compatible `machine` JSON (+ zones / instructions).
3. **The machine owns progression, bots, and rewards.** The human clicks on-screen controls; the FSM deals, runs bots, and settles. There are no agent deal/bet/award tools.
4. **Your job is to explain.** Use `get_game_state` + `narrate` (and in tutorial: `highlight` + `await_user_action`). Never move the human seat.

## Router

These are the only card-table tools:

| Intent | Tool |
| --- | --- |
| Compact state | `get_game_state` |
| Student log / explain what happened | `narrate` |
| Sidebar how-to | `set_instructions` |
| Focus student attention (tutorial) | `highlight` |
| Wait for human click (tutorial) | `await_user_action` |
| Start catalog / custom FSM | `create_game` |
| List catalog | `list_presets` |

## Tutorial

1. `highlight` the target + `narrate` what to do.
2. `await_user_action({ expectActionId })` until the human clicks.
3. Re-narrate from the new state (`matched:false` → correct and re-await).
4. Do not invent the next buttons or awards — read them from state.

## Custom games

Write an XState `machine` (see `reference.md`): states, `meta.controls` (human buttons → events), named actions/guards from the registry (`chipBet`, `dealSpec`, `settleBlackjack`, `handBusted`, …). Settlement and phase changes belong in the machine, not in free-form tool calls.

## Rules

- Never perform the human's actions.
- Do not recreate a preset that `list_presets` already lists.
- Keep `narrate` educational and short; do not dump JSON state.
- Do not reason about award amounts or next phases for catalog games — the FSM already did.
