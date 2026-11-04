---
phase: 07-webview-tour-blocks
status: passed
verified: 2026-11-04
---

# Phase 7 verification

The orchestrator checked this phase in autonomous mode with typecheck, tests (72/72), the smoke run ("14 commands, 3 views, tour opened"), and greps. The dist `tour.js` contains 0 `innerHTML`. Nothing was checked visually in a live window.

| Req | Evidence | Status |
|-----|----------|--------|
| BLOCK-01 | `blocks/p.ts`: inline code, bold, file links, basis tags (Phase 5), kept | ✓ |
| BLOCK-02 | `src/tour/align.ts` builds rows from git hunks, with focus and marks (tested in a temp repo). `blocks/code.ts` renders BEFORE/AFTER with tints and the hatched missing side | ✓ |
| BLOCK-03 | `diagrams.ts` covers timeline, flow and schema; `text.ts` covers table, list, quote, pre and rows; `repo.ts` covers target and files | ✓ |
| BLOCK-04 | diff, rows and pre are rendered, and the unknown-kind fallback from Phase 5 is kept. All 14 kinds have a registered renderer | ✓ |
| BLOCK-05 | `snippet.ts`: "Not in this repository" label and Copy through the host clipboard. Nothing applies it to files | ✓ |
| BLOCK-06 | Question steps show the "Stop and predict before you go on" card with the guess textarea and "Show the answer". `previousGuess` shows on the answer step | ✓ |
| BLOCK-07 | The clamp in `align.ts` sets the "approximate" badge. A missing file shows a not-found message instead of throwing | ✓ |

Not checked: the visual layout in a live VS Code window. The schema block shows tables and focus but does not parse migrations, as CONTEXT decided.
