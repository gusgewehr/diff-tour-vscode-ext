---
phase: 07-webview-tour-blocks
plan: 02
subsystem: webview
tags: [webview, code, diff, target, files]
requires: [07-01]
provides: [blocks/code.ts, blocks/repo.ts, BlockCtx.data/base/head, errorBox]
affects: [07-03]
key-files:
  created: [src/webview/tour/blocks/code.ts, src/webview/tour/blocks/repo.ts]
  modified: [src/webview/tour/blocks/index.ts, src/webview/tour/main.ts, media/tour.css]
decisions:
  - "code and diff share one build() function; two register() calls so each narrows its own block kind"
  - "Tasks 1 and 2 committed together (shared tour.css)"
metrics:
  completed: 2026-11-04
---

# Phase 7 Plan 02: Git-backed block renderers Summary

Side-by-side BEFORE | AFTER code/diff blocks (line numbers, del/add tints, hatched missing side, focus edge, marks, header stats, approximate badge, missing-file message, open button), target (commit list with AI CO-AUTHOR badge) and files (grouped, with +a -d, click opens read-only). Unknown kinds show "not shown in this version". DOM built with el()/textContent only; bundle has no innerHTML.

## Deviations from Plan
- Both tasks in a single commit rather than two (shared CSS file). No functional deviation.
- Visual check in a real VS Code window not performed (autonomous run); only typecheck, tests, build, smoke and bundle check.

## Verification
typecheck, 72 tests, build, smoke pass; innerHTML count 0.

## Self-Check: PASSED
