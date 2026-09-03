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

Host relays may expose **bare** names (`create_game`) or **suffixed** names (`create_game_8a66`).

1. Prefer bare names when present. If only suffixed names appear, pick the source with the latest `lastSeenAt` via `webmcp_list_sources`.
2. One `GetDynamicTools` pass (pattern covering the tools you need) is enough — do not re-fetch per-tool schemas after `create_game`. Session and tutorial tools are always listed; they error until a session exists.
3. Do not invent suffix variants. If a call 404s, rediscover once; do not loop.

## Start

1. `list_presets` **only** before inventing a custom game. If the user already named a catalog preset (e.g. blackjack), skip it — `create_game`'s `preset` enum is enough.
2. Catalog → `create_game` with `preset` (name optional). Custom → omit `preset`; pass `name` + XState-compatible `machine` JSON (+ zones / instructions).
3. **The machine owns progression, bots, and rewards.** The human clicks on-screen controls; the FSM deals, runs bots, and settles. There are no agent deal/bet/award tools.
4. **Your job is to explain.** Prefer `coach` in tutorial. Otherwise use `narrate` / `highlight` / `await_user_action`. Never move the human seat.

## Router

These are the only card-table tools:

| Intent | Tool |
| --- | --- |
| Compact state | `get_game_state` (prefer state from `create_game` / `await_user_action` / `coach`) |
| Student log / teach what the machine did not say | `narrate` |
| Sidebar how-to | `set_instructions` |
| Focus student attention (tutorial) | `highlight` |
| Wait for human click (tutorial) | `await_user_action` — returns **state**; do not `get_game_state` after |
| Teach one step (tutorial) | `coach` — narrate + highlight + await + **state** in one call |
| Start catalog / custom FSM | `create_game` |
| List catalog | `list_presets` |

## Tutorial

1. Prefer `coach({ text, target, label, expectActionId })` for each human decision.
2. Or: `highlight` + `narrate`, then `await_user_action({ expectActionId })`.
3. Read the next controls / cards from the **returned `state`**. Only call `get_game_state` if that payload was lost.
4. On `matched:false`, correct and re-coach / re-await.
5. Do not invent the next buttons or awards — read them from state.

## Narration

- The **machine** already logs event lines (bet placed, dealt, win/push). Do **not** re-narrate those.
- Agent `narrate` / `coach.text` should add teaching the machine omitted (hand totals, why Hit vs Stand).
- Keep lines short; `narrate` returns only the appended entry.

## Custom games

Write an XState `machine` (see `reference.md`): states, `meta.controls` (human buttons → events), named actions/guards from the registry (`chipBet`, `dealSpec`, `settleBlackjack`, `handBusted`, …). Settlement and phase changes belong in the machine, not in free-form tool calls.

## Rules

- Never perform the human's actions.
- Do not recreate a preset that `list_presets` / the `create_game` enum already lists.
- Keep `narrate` educational and short; do not dump JSON state.
- Do not reason about award amounts or next phases for catalog games — the FSM already did.
- Prefer one `actions` highlight when coaching a click; reserve hand highlights for reveal/settlement beats.
- `coach` with `expectActionId` pins the click cue on that button (label included). Do not put click labels on top bot seats.
