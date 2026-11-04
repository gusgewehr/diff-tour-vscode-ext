---
phase: 02-extension-skeleton-change-picker
plan: 02
subsystem: extension-ui
tags: [quickpick, treeview, routing]
requires: [02-01]
provides: [src/cli/detect.ts, src/pick.ts, src/views/changesTree.ts, src/extension.ts]
affects: [02-03]
key-files:
  created: [src/cli/detect.ts, src/cli/detect.test.ts, src/pick.ts, src/views/changesTree.ts, src/extension.ts]
decisions:
  - "Tasks 2 and 3 committed together (tree wiring is tiny and extension.ts is shared)"
  - "Tree click command has no model arg; pick.ts keeps a module-level currentModel set by activate"
  - "Internal commands openSmallChange/startTour/openSavedTour are info-message stubs for Phases 3-5"
metrics:
  tasks: 3
  completed: 2026-11-04
---

# Phase 2 Plan 02: Picker, tree, routing Summary

CLI/Claude detection (no shell, 5s timeouts), shared ChangeModel (progressive parallel counting, max 6), grouped QuickPick, TOUR activity-bar tree, activation and locked internal routing commands. typecheck, build and 12 tests pass. Not exercised inside a real VS Code host yet (02-03 smoke covers activation only).

## Deviations from Plan

- Commands are registered through a local `reg()` helper, so the literal grep `registerCommand('difftour.` finds fewer than 6 hits; all 6 commands are registered.
- Tasks 2 and 3 share one commit.

## Self-Check: PASSED
