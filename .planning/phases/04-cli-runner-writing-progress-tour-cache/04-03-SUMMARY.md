---
phase: 04-cli-runner-writing-progress-tour-cache
plan: 03
subsystem: cli
tags: [startTour, wiring, vsix]
requires: [04-01, 04-02]
provides: [src/cli/startTour.ts]
key-files:
  created: [src/cli/startTour.ts]
  modified: [src/extension.ts, src/pick.ts, scripts/smoke-activate.mjs]
decisions:
  - "openSavedTour receives the cached tour file path (saveTour return value), keeping the existing one-argument contract for Phase 5"
  - "Notification progress, status bar item, Writing panel and OutputChannel all driven from one reducer state"
metrics:
  completed: 2026-11-04
---

# Phase 4 Plan 03: startTour wiring Summary

Replaced the startTour stub: tool re-check (PICK-07 notice), cancellable `withProgress` notification, spinner status item (reveals Writing panel), Writing panel, atomic cache on done, "Your tour is ready" / open directly if the panel was focused, mapped error actions, and Skip to the tour for an existing saved tour. Added `difftour.internal.revealWriting`. One run at a time. Smoke prints "smoke ok: 8 commands, 2 views"; 30 tests pass; VSIX packaged (includes writing.js/css) and installed.

Commit: feat(04-03) wiring commit, plus docs commit.

## Deviations from Plan
None in code. Not verified: a live end-to-end run inside VS Code (no GUI, and no real tour generated to avoid cost); the optional cached re-run of headless-run.mjs was skipped. The flow is covered only by typecheck, smoke and the unit tests of the underlying pieces.

## Self-Check: PASSED
