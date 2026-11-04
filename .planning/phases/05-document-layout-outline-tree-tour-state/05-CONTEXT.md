# Phase 5: Document layout, outline tree, tour state - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions per the user's instruction: speed over polish, never ask the user.

<domain>
## Phase Boundary

This phase replaces the `difftour.internal.openSavedTour(pathOrKey)` stub. Opening a tour does three things:
- loads the tour JSON;
- shows it in a Document Webview with a sticky bottom nav and an outline tree;
- persists per-tour state.

Block rendering here is minimal: `p` is rendered properly, and every other kind gets a muted placeholder. Phase 7 renders all block kinds through the registry this phase creates. Opening code is a stub command that Phase 6 implements.

</domain>

<decisions>
## Implementation Decisions

### Model (`src/tour/model.ts`)
- TypeScript types mirror `cli/internal/tour/tour.go`, as documented in `docs/tour-schema.md`.
  - `Tour{version,title,base,head,chapters}`
  - `Chapter{title,steps}`
  - `Step{title,question?,asks?,asked?,open?,blocks}`
  - `Block` is a union keyed by kind: p(+basis), quote, list, pre, table, code, diff, snippet, schema, rows, flow, timeline, files, target.
  - `FlowNode` has optional `file` and `lines`, added by the Phase 1 fork.
- `loadTour(text)` parses the JSON, checks `version === 1` and that there is at least one step, and keeps unknown block kinds as `{kind:'unknown', raw}`.
- `flatten(tour)` returns `[{chapterIndex, stepIndex, step, globalIndex}]`.

### Identity and opening
- `openSavedTour(path)` always receives a file path (Phase 4 decision): the SAVED group, the "Your tour is ready" notice and Skip all pass `<globalStorage>/tours/<key>.json`.
  - If a sibling `<key>.meta.json` exists, use it. The id is the key.
  - Otherwise (the "A saved tour file…" option), the id is `file-<sha1(abs path)>`, and the meta is built from the tour's `base` and `head` refs, resolved to SHAs with `git rev-parse` / `merge-base` when possible.
- The tour id is the cache key, and it keys all state.
- Only one active tour session. Opening another tour replaces it.

### Session (`src/tour/session.ts`)
- `TourSession` holds the tour, meta, flat steps and current index, and exposes an `onDidChange` EventEmitter.
- Methods: `next()`, `prev()`, `goto(i)`, `toggleUnderstood()`, `setNote(text)`, `setGuess(text)`.
- Marks the current step as visited on every move.
- The outline tree, Webview and status bar subscribe to it.
- Context key `difftour.tourActive` is true while a session exists.
- Disposing the panel ends the session. The outline view then hides through its `when` clause.

### State (`src/tour/state.ts`, DOC-06)
- Stored in `context.workspaceState` under key `difftour.state.<id>`.
- Shape: `{step, done:{[i]:true}, visited:{[i]:true}, notes:{[i]:string}, guesses:{[i]:string}}`.
- Saved on every change. Note and guess writes are debounced by 300 ms.
- Restored when the same tour opens again.

### Document Webview (`src/webview/tourPanel.ts` + `src/webview/tour/main.ts`)
- **Tech:** plain TypeScript DOM, no framework, bundled by esbuild to `dist/webview/tour.js`. Reuse the Phase 4 `src/webview/html.ts` CSP/nonce helper.
- **Panel:** view type `difftour.tour`. `retainContextWhenHidden: true`. A `WebviewPanelSerializer` is registered and restores from `{id}` in the webview state by reopening that tour.
- **Protocol:**
  - The webview sends `{type:'ready'}`. The host replies with `render`.
  - Host → webview: `{type:'render', title, base, head, chapterTitle, index, total, step, ticks:[{state:'current'|'understood'|'visited'|'unvisited'}], understood, note, guess, prevTitle, nextTitle}`.
  - Webview → host intents: `ready`, `next`, `prev`, `goto{index}`, `understood`, `note{text}`, `guess{text}`, `openCode{block index}`, `openFile{file,line,at}`.
  - The host validates every incoming message's shape and ignores bad ones.
- **Layout** (spec 4a, high fidelity, colors only from `--vscode-*`):
  - Content column max-width 880px.
  - Tour title in a serif stack (`Newsreader, Georgia, 'Times New Roman', serif`, 32–36px). No bundled font files: system fonts, no network, which satisfies DOC-07.
  - Chapter label in small uppercase.
  - Step title.
  - Blocks.
  - MY NOTE card, a textarea shown when the step has a note or after N.
  - Sticky bottom nav bar, 58px, containing:
    - Prev button ("← n · title")
    - 16-tick progress bar: one tick per step, scaled down if there are more steps. The current tick is 10px tall in the text color, understood ticks use the accent (`--vscode-focusBorder` or `--vscode-textLink-foreground`), visited ticks a dim accent, unvisited ticks grey. Ticks are clickable and go to that step.
    - "Mark as understood (U)" toggle
    - "Note (N)"
    - Next button ("n · title →")
- **Block renderer registry** `src/webview/tour/blocks/index.ts`: `register(kind, fn)` and `renderBlock(block)`.
  - Phase 5 implements `p`. Inline markup covers `code`, `**bold**` and file links shaped like `path/to/file.ext:10`. File links are clickable and post `openFile`. The basis tag is shown in the left gutter: fact → "Verified", inferred → "From the code", opinion → "Senior view".
  - Every other kind gets a muted fallback box: kind name plus "rendered in a later update".
- **Safety (DOC-08):** never use `innerHTML` with tour text. Build DOM nodes with `textContent`. Write a tiny tokenizer for the inline markup. The CSP has `script-src 'nonce-…'` and allows no inline handlers.
- **Keys (DOC-03/04/05/09):** ← and → move between steps, U toggles understood, N toggles and focuses the note, o opens the primary code (`openCode` for the first code block, or `step.open`), and Esc blurs the note. All of these are ignored while focus is in a textarea or input, except Esc.
- **Theme (DOC-07):** handle `body.vscode-light`, `vscode-dark` and `vscode-high-contrast`. High contrast uses `--vscode-contrastBorder` borders.

### Outline tree (`src/views/outlineTree.ts`, DOC-02)
- View `difftour.outline`, titled "Tour", in the TOUR container. `when: difftour.tourActive`.
- Tree: chapters → steps. Step icons are ThemeIcons:
  - understood → `pass-filled`
  - current → `play-circle`
  - question → `question`
  - otherwise → `circle-large-outline`
- A step with a note gets description "✎ note".
- `treeView.description` shows "x of N understood".
- Clicking a step calls `session.goto(i)` and reveals the panel.

### Status bar
- `$(book) Step n / N` while a tour is active. Clicking it reveals the panel.

### Code-open stub
- Register `difftour.internal.openCode({tourId, file, at, lines})` as a stub that shows an info message. Phase 6 implements it.

### Tests (`node --test`)
- `loadTour` against all fixtures in `fixtures/tours/`.
- `flatten`.
- Session navigation and visited marking.
- State round-trip with a fake Memento.
- The inline tokenizer, including a check that `<script>`/HTML stays literal text.
- The message validator.
- Extend `smoke-activate.mjs` for the new commands and views.

### Claude's Discretion
- File split, CSS details, how ticks scale with more than 16 steps.

</decisions>

<code_context>
## Existing Code Insights

- Phase 4 adds `src/webview/html.ts` (CSP/nonce helper), the esbuild webview entry pattern (`dist/webview/<name>.js`), the cache under `globalStorageUri/tours/<key>.json` and `<key>.meta.json`, and `fixtures/tours/*`. Read the Phase 4 SUMMARY files for exact names.
- Fixtures: `real-*.json` (6 chapters each) and `example-coupons.en.json`.

</code_context>

<specifics>
## Specific Ideas

- Design reference: `docs/handoff/screenshots/04-tour-document-step1.png` and the README section "4a. Document".

</specifics>

<deferred>
## Deferred Ideas

- Focus and Inline layouts (v2).
- Bundled Newsreader/IBM Plex fonts. Skipped for speed; system serif instead.

</deferred>
