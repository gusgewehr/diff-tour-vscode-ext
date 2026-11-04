---
phase: 07-webview-tour-blocks
plan: 03
subsystem: webview
tags: [webview, blocks, question, packaging]
requires: [07-01, 07-02]
provides: [text.ts, diagrams.ts, snippet.ts, question/guess cards, reinstalled VSIX]
affects: [08]
key-files:
  created: [src/webview/tour/blocks/text.ts, src/webview/tour/blocks/diagrams.ts, src/webview/tour/blocks/snippet.ts]
  modified: [src/webview/tour/main.ts, media/tour.css]
decisions:
  - "Schema block shows tables and focus columns only (no migration parsing), per CONTEXT"
  - "Flow chips use host-provided FlowData; without it paths are split locally and no chips are drawn"
  - "Tasks 1-3 committed together (shared main.ts and tour.css)"
metrics:
  completed: 2026-11-04
---

# Phase 7 Plan 03: Remaining blocks, question cards, VSIX Summary

quote, list, pre, table, rows, schema, timeline, flow (step chips, open-file link) and snippet (Copy only, always labelled "Not in this repository") renderers, plus the violet "Stop and predict" card with guess textarea and the "Your guess" card on the following step. All 14 block kinds now have a registered renderer; unknown kinds fall back.

## Verification
typecheck, 72 tests, build, smoke pass; bundle has no innerHTML; all 14 `register('<kind>'` present. `npm run package` wrote diff-tour.vsix (10 files, 36.8 KB); `code --install-extension diff-tour.vsix --force` printed "Extension 'diff-tour.vsix' was successfully installed."
Rendering was verified by build, tests and mock smoke only, not in a live VS Code window.

## Deviations from Plan
- [Rule 1 - Bug] Fixed a TS error in the table renderer (append returns void) before build.
- Single commit for all three tasks.

## Self-Check: PASSED
