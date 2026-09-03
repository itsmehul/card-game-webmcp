---
name: card-table
description: >-
  Routes Playing cards simulator WebMCP tools for catalog and custom card games (Texas Hold'em,
  Blackjack, War, Go Fish, Crazy Eights, Euchre, Gin Rummy, Bullshit). Use when
  playing, teaching, dealing, betting, or inventing a game on this table; when
  calling list_presets, create_game, get_game_state, legalActions, or any
  user-webmcp-local-relay card tool.
---

# Playing cards simulator tools

Tool schemas stay on the MCP server. This file is the playbook: **which tool, when**. Do not paste it into narration. Fetch `skills://card-table/reference.md` (WebMCP resource) only when writing a custom XState `machine` for `create_game`.

Seats: `human`, `bot_1`… Zones: `stock`, `hand`, `play`, `discard`, `capture`.

## Hard ban: do not drive the website

This table is taught over **WebMCP**, not by operating the page.

- **Forbidden:** browser automation, Playwright/Puppeteer, CDP clicks, screenshot-and-click, DOM `click()`, Cursor/Claude browser tools, or any proxy that presses Play / Tutorial / Bet / Deal / Hit / Stand for the student.
- **Forbidden:** starting a game by clicking catalog cards on the page.
- **Required:** `create_game` (with `mode: "tutorial"` when teaching) + `coach` / `await_user_action` so the **human** presses every control.
- Saying "I'll click Stand for you" is a failure. Cue the button with `coach({ expectActionId })` and wait.

If you only have a browser tool and no WebMCP relay tools, stop and tell the user to open the Playing cards simulator page with WebMCP connected — do not fall back to clicking the UI.

## Connect (fast path — do this first)

Playing cards simulator tools come from **already-open browser tabs** via the WebMCP relay. Prefer reusing them; never thrash discovery.

1. Call `webmcp_list_sources` once.
2. If **any** source has origin `https://learnplayingcards.vercel.app` (or the localhost/dev origin in use) — home `/` **or** `/game/...` — pick the one with the latest `lastSeenAt` and call `create_game` on **that** source's tools. Done. Do **not** call `webmcp_open_page`.
3. User deep links (`/game/game_…`) mean "I'm on the table," **not** "open this exact URL." `create_game` always starts a **new** session and the page navigates to `/game/<newId>` itself. Ignore path mismatch between the link and the connected tab.
4. Call `webmcp_open_page` **only** when `list_sources` has **zero** same-origin Playing cards simulator sources. Then wait and `list_sources` once more. Never open a second tab when one is already connected.
5. If you must reload a stale tab, use `webmcp_open_page` with `refresh: true` (matches by **origin**, not full path). Prefer that over a new tab. Still unnecessary when tools are already callable.

## Discover tools

Host relays may expose **bare** names (`create_game`) or **suffixed** names (`create_game_8a66`).

1. Prefer bare names when present. If only suffixed names appear, pick the source with the latest `lastSeenAt` via `webmcp_list_sources` and use **that** source's suffix (from the source's `tabId` prefix in tool names, or from tools already listed in the host).
2. One `GetDynamicTools` pass (pattern like `create_game|coach|await_user_action|…`) is enough — do **not** dump the full namespace, do **not** call `webmcp_list_tools`, and do not re-fetch per-tool schemas after `create_game`. Session and tutorial tools are always listed; they error until a session exists.
3. Do not invent suffix variants. If a call 404s, rediscover once via `list_sources` + one schema pass; do not loop.

## Start

1. `list_presets` **only** before inventing a custom game. If the user already named a catalog preset (e.g. blackjack), skip it — `create_game`'s `preset` enum is enough.
2. Catalog → `create_game` with `preset` (name optional) and `mode: "tutorial"` when teaching. Custom → omit `preset`; pass `name` + XState-compatible `machine` JSON (+ zones / instructions).
3. **The machine owns progression, bots, and rewards.** The human clicks on-screen controls; the FSM deals, runs bots, and settles. There are no agent deal/bet/award tools.
4. **Your job is to explain.** Prefer `coach` in tutorial. Otherwise use `narrate` / `highlight` / `await_user_action`. Never move the human seat.

Ideal cold start when a tab is already connected:

`list_sources` → `create_game` → `coach` (skip open_page, list_tools, list_presets, full schema dumps).

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

- Never perform the human's actions — not via WebMCP, not via browser tools, not "for them."
- Never click catalog Play/Tutorial, Bet, Deal, Hit, Stand, or any other table control.
- Do not recreate a preset that `list_presets` / the `create_game` enum already lists.
- Keep `narrate` educational and short; do not dump JSON state.
- Do not reason about award amounts or next phases for catalog games — the FSM already did.
- Prefer one `actions` highlight when coaching a click; reserve hand highlights for reveal/settlement beats.
- `coach` with `expectActionId` pins the click cue on that button (label included). Do not put click labels on top bot seats.
- Never `webmcp_open_page` when a same-origin Playing cards simulator source is already connected.
- Never `webmcp_list_tools` or full-namespace schema dumps to pick a suffix — use `list_sources` + one targeted `GetDynamicTools` pass.
