---
phase: 03-small-change-rule
plan: 01
subsystem: small-change
tags: [vscode, git, diff, tree-view, status-bar]
requires: [phase-02 routing (routeTarget), git helper]
provides: [real difftour.internal.openSmallChange, SmallChange.hide() for Phase 4]
affects: [src/extension.ts, package.json]
tech-stack:
  added: []
  patterns: [pure logic module without vscode import, vscode.git toGitUri with own content-provider fallback]
key-files:
  created: [src/small/logic.ts, src/small/logic.test.ts, src/small/smallChange.ts]
  modified: [src/git/changes.ts, src/git/changes.test.ts, src/extension.ts, package.json, scripts/smoke-activate.mjs]
key-decisions:
  - "Skipped optional root-node vscode.changes button (CONTEXT marks it optional)."
  - "Added -ref guard in listChangedFiles as well as in the content provider."
requirements-completed: [SMALL-01, SMALL-02, SMALL-03]
duration: 20min
completed: 2026-11-04
---

# Phase 3 Plan 1: Small-change rule Summary

Changes under `difftour.minFiles` now open the first changed file in `vscode.diff` (git extension URIs, `difftour-git` provider fallback and for empty A/D sides), with a "Small change" tree (M/A/D/R), an Open Settings notice, and a "No tour" status bar item that runs `difftour.tourChange`.

## Tasks
1. Name-status parser (`parseNameStatus`, `listChangedFiles`) and pure `sides`/`noticeText`/`statusText` with tests: c380257
2. `SmallChange` glue, extension wiring, `difftour.smallChange` view, smoke update, VSIX rebuilt and reinstalled: 8477f38

## Deviations from Plan
None in behaviour. Process note: an inline Python edit briefly wrote CRLF and a NUL byte into changes.ts; fixed to LF and `'\0'` before commit.

## Verification
typecheck, npm test (16 pass), build, smoke ("7 commands, 2 views"), package, `code --install-extension` all succeeded. Not verified: interactive behaviour inside a live VS Code window.

## Known Stubs
None for this plan (startTour and openSavedTour remain Phase 4/5 stubs by design).

## Self-Check: PASSED
