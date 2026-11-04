---
phase: 05-document-layout-outline-tree-tour-state
plan: 03
subsystem: host-wiring
tags: [controller, panel, outline, smoke, vsix]
requires: [05-01, 05-02]
provides: [resolveTour, TourPanel, TourController, activeSession, OutlineTree, openCode stub]
key-files:
  created: [src/tour/open.ts, src/tour/open.test.ts, src/tour/controller.ts, src/webview/tourPanel.ts, src/views/outlineTree.ts]
  modified: [src/extension.ts, package.json, scripts/smoke-activate.mjs]
requirements-completed: [DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-08]
completed: 2026-11-04
---

# Phase 5 Plan 03: Host wiring Summary

openSavedTour now opens the tour in a `difftour.tour` webview panel with an outline tree, status bar item, persisted state and serializer restore; every webview message passes parseIntent. Smoke test opens the real fixture against the mock (render, next, invalid-message ignore, state persisted, context key true/false). 50 unit tests, typecheck, build, smoke pass; VSIX rebuilt (diff-tour.vsix is gitignored) and installed via `code --install-extension`.

## Commits
- resolveTour, TourPanel, TourController (feat(05-03))
- outline tree, extension wiring, contributions, smoke (feat(05-03))

## Decisions / Deviations
- None from plan. Opening a second tour while a panel exists reuses the panel (retitles and reveals).
- Not verified in a live VS Code window: only the mock smoke and install succeeded.

## Known Stubs
`difftour.internal.openCode` shows an info message by design; Phase 6 implements it.

## Self-Check: PASSED
