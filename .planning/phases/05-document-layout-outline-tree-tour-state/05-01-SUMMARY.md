---
phase: 05-document-layout-outline-tree-tour-state
plan: 01
subsystem: tour-core
tags: [model, state, session, messages]
requires: [src/cli/cache.ts TourMeta]
provides: [loadTour, flatten, StateStore, TourSession, parseIntent, renderMessage, primaryCode, codeTargetForBlock]
key-files:
  created: [src/tour/model.ts, src/tour/state.ts, src/tour/session.ts, src/tour/messages.ts, src/tour/model.test.ts, src/tour/session.test.ts, src/tour/messages.test.ts]
requirements-completed: [DOC-03, DOC-04, DOC-05, DOC-06, DOC-08]
duration: ~10min
completed: 2026-11-04
---

# Phase 5 Plan 01: Tour core Summary

vscode-free tour model/loader, debounced Memento-backed state, TourSession navigation, and validated host/webview message contract, all tested against the real fixtures (43 tests pass, typecheck clean).

## Commits
- f2744a1 model, loader, flatten, identity helpers
- 7bdc19c state, session, messages

## Deviations from Plan
- Test-only: the plan's renderMessage bullet expected tick 1 'visited' after `goto(2)`; goto does not visit skipped steps, so the test uses next(), next(). Session behavior unchanged.
- Test-only: first fixture code block has `at: 'base'`, so the assertion compares against the block's own `at`.

## Known Stubs
None.

## Self-Check: PASSED
