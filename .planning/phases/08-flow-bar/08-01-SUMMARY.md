---
phase: 08-flow-bar
plan: 01
subsystem: ui
tags: [webview-view, flow, vscode]
requires: [flow.ts helpers from phase 7, TourController/TourSession]
provides: [difftour.flowBar panel view, buildBar, resolveClick]
affects: [package.json, src/extension.ts, scripts/smoke-activate.mjs]
key-files:
  created: [src/tour/flowBar.ts, src/tour/flowBar.test.ts, src/views/flowBarView.ts, src/webview/flow/main.ts, media/flow.css]
  modified: [src/extension.ts, package.json, scripts/smoke-activate.mjs]
key-decisions:
  - "Flow bar is a WebviewView in a new bottom panel container difftourFlow (single 48px row inside a user-sized panel; accepted deviation from a fixed-height strip)"
  - "Dedupe: consecutive duplicate nodes (label+file) and paths with an identical label+file sequence are dropped"
  - "Only the first matching node overall is current"
requirements-completed: [FLOW-01, FLOW-02, FLOW-03, FLOW-04]
duration: ~15min
completed: 2026-11-04
---

# Phase 8 Plan 1: Flow bar Summary

Persistent clickable flow strip as a bottom-panel WebviewView `difftour.flowBar`, driven by pure `buildBar`/`resolveClick` reusing Phase 7 flow helpers.

## Tasks
1. Pure logic + tests: fae521d
2. View provider, webview bundle, css, package.json, extension wiring: 78d0fe9
3. Smoke coverage: 05f46dd; npm test (75 pass), smoke, package and `code --install-extension` all succeeded.

## Deviations from Plan
None in code. The view auto-shows on tour start via `view.show(true)` (or `difftour.flowBar.focus` before first resolve, then focus returned to the tour panel). STATE.md was updated manually because `state.advance-plan` cannot parse it.

## Known Stubs
None.

## Threat Flags
None. Click messages validated with Number.isInteger and range against the last posted bar; file/lines come from host state; webview uses textContent only.

## Self-Check: PASSED
