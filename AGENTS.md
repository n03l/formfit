# Formfit: notes for developers and coding agents

This file covers how the project is built, deployed and tested. `README.md` is for players: it explains how the game
works, and should stay free of technical detail.

> **Keep `README.md` up to date.** Whenever a change affects what a player sees or does, update `README.md` in the
> same change. That includes the rules, scoring, combos, levels and difficulty, controls, buttons, game over,
> saving, offline play, installing, and signing in. Describe it in plain language for players, with no file names
> or code. Check every number and rule in it against the code before finishing.

## Overview

Formfit, a block puzzle game played in levels. The whole game (HTML, CSS and JavaScript) is in `index.html`, with no
dependencies and no build step. It is a Progressive Web App (installable, playable offline), hosted as static files
on GitHub Pages at https://n03l.github.io/formfit/. Every push to `main` in `n03l/formfit` publishes it through the
`.github/workflows/pages.yml` workflow. The site is public: there is no login and no server code.

| File | Purpose |
|---|---|
| `index.html` | The game. |
| `sw.js` | Service worker for offline play. |
| `manifest.webmanifest`, `icons/` | PWA metadata and icons. `icons/icon.svg` is the source; the PNGs are rendered from it. |
| `dev-server.mjs` | Local static server for development. |
| `.github/workflows/pages.yml` | Publishes the app files (only those) to GitHub Pages. Actions are pinned to commit SHAs. |
| `docs/screenshot.png` | Phone screenshot shown in `README.md`. Not part of the app. |
| `LICENSE` | GNU AGPL v3 (or later). |

**Identifiers players depend on:** renaming these breaks things for existing players, so don't change them
without a plan:

| Identifier | What renaming it would break |
|---|---|
| `formfit.*` `localStorage` keys | Wipes every player's best score and level progress. |
| The site's address (origin) | Moving to another domain also starts every player from scratch: saved data belongs to the origin. |

The service worker deletes old `formfit-*` caches, so bumping `CACHE` within that prefix is safe.

**Shared origin:** on GitHub Pages, every project of the account is served from the same origin
(`n03l.github.io`), so they share `localStorage` and cache storage. Only touch keys and caches with Formfit's own
prefixes, never clear or delete everything.

## Game internals (`index.html`)

- **Board:** 8×8 array. Each cell is `null`, a colour index `0..6`, or `STONE` (`7`) for a level's grey obstacles.
- **Levels:**
  - `levelLayout(n)` places the stones using a PRNG seeded by the level number (`mulberry32`), so every level is
    a fixed puzzle.
  - The number of stones is `stoneCount(n)`: 3 at level 1, +2 per level up to level 8 (17), then +1 per level, up
    to 30.
  - The stones sit only on `targetLines(n)` rows or columns: 1 line at levels 1–2, growing slowly. There are always
    enough lines to hold every stone within the `maxPerLine(n)` cap (4 up to level 4, then 6, then 7 from level 8).
    No line ever starts full.
  - On each line the stones form solid runs, so the gaps left are easy to fill: 1 run per line up to level 12, 2
    runs up to level 19, then 3.
  - A level is complete when `stonesLeft()` reaches 0.
  - **Tuning:** the curve was tuned with a greedy bot that plays through synthetic pointer events. It completed
    levels 1–3 in ~97–100% of attempts, levels 4–5 in ~75–87%, levels 6–7 ~65%, level 8 ~40% and levels 9–12
    ~5–20%. After changing any of these constants, re-measure the same way, and keep level 1 near 100%.
- **Pieces:**
  - `BASES` lists the shapes. Each has a weight and a tier: `e`(asy), `m`(edium) or `h`(ard).
  - `tierFactor()` sets how common each tier is. At level 1, hard shapes are ×0.25 and easy ones ×1.5. Both reach
    ×1 at level 5, then hard shapes keep rising to ×3, and easy ones fall to ×0.35.
  - `newBatch()` deals 3 pieces and retries so that at least one of them fits.
  - **Helpful sets:** with probability `helpChance(level)` (always up to level 3, then 80/60/40/20%, none from
    level 8), the set must also include a piece that can complete a line containing a stone (`clearsAStone()`),
    whenever any shape could. If random deals don't produce one, a helpful shape replaces the first piece.
  - **Rotatable pieces:** with probability `spinChance(level)` (5% up to level 3, then +5% per level up to 25% from
    level 7), one piece of the set that has more than one orientation gets `spin: true`. The player taps it to
    rotate it (`rotateCW()`). A pointer that moves less than `TAP_SLOP` px is a tap, and a tap never places a piece.
    `pieceFits()` counts every rotation of such a piece, for greying it out and for game over.
- **Saved data (`localStorage`):**
  - `formfit.best`: best score.
  - `formfit.levels`: `{level, unlocked}`.
  - `formfit.state`: the game in progress.
  - `formfit.muted`: sound setting.

  All of these are treated as untrusted on load. `loadLevels()` and `loadState()` check every field's type and
  range, and throw the data away if anything is wrong. Keep that when adding fields. Old saves are discarded rather
  than migrated.
- **Rendering** uses DOM APIs, `textContent` and class names only, never `innerHTML` with data.
- **Content-Security-Policy:** the `<meta>` tag allows inline script and style, plus `'self'` for images, the
  manifest and the worker. Nothing is loaded from other sites.

## Layout: portrait only

The game is designed to be played in **portrait**, on a phone held upright. Landscape is not supported.

- **Installed app:** `manifest.webmanifest` sets `"orientation": "portrait"`, so it always opens upright.
- **Browser tab:** a phone turned sideways in a browser tab shows the same portrait layout. It doesn't fit, so the
  page scrolls and the tray is partly cut off. This is a known limitation, not a bug: don't spend effort on
  landscape layouts unless asked.
- **Desktop:** the game is a single portrait column, centred on the page. Keep it that way: no side-by-side
  layouts.
- **Fitting the screen:** everything is sized from `--board` in the CSS:
  `max(232px, min(92vw, 100dvh − 350px, 480px))`. The 350px is reserved for everything above and below the board:
  title, level banner, stats and tray. If you add, remove or resize anything there, adjust that value so the
  whole game still fits **without scrolling** on the target sizes below.
- **Target sizes:**
  - 320×568 (smallest supported phone)
  - 360×640
  - 390×844
  - 412×915
  - 1280×800 (desktop)

## Develop and test

```sh
node dev-server.mjs   # http://localhost:8090/  (or: npm run dev)
```

- `dev-server.mjs` listens on `127.0.0.1` only, rejects any `Host` that isn't localhost, and serves only the files in
  its `FILES` list.
- UI changes: test with headless Playwright against the dev server.
  - Drag pieces and assert on the board, score and level banner.
  - Fail on any console error or uncaught page error.
  - Inject hostile `localStorage` values, such as `<img src=x onerror=alert(1)>`, wrong types or out-of-range
    levels, and check the game starts fresh.
  - Check the layout at the portrait target sizes (see "Layout: portrait only") with no page scrolling. Don't
    test or fix landscape.

## Conventions

- **Adding a file the app needs:** add it to `SHELL` in `sw.js`, to `FILES` in `dev-server.mjs`, and to the copy step
  in `.github/workflows/pages.yml` (the workflow fails if `SHELL` names a file it didn't publish). Use relative
  paths: on GitHub Pages the game lives under a subpath (`/formfit/`), not at the domain root.
- **The repository is public.** Never commit secrets or personal data.
- **Changing a cached file:** bump `CACHE` in `sw.js` (currently `formfit-v3`) whenever any file in `SHELL`
  changes, so installed copies download the new files.
- **Changing anything a player notices:** update `README.md` in the same commit (see the note at the top). If
  nothing in it needs to change, say so in your summary.
