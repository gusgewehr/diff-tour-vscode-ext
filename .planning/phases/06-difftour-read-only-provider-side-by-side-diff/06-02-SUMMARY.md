---
phase: 06-difftour-read-only-provider-side-by-side-diff
plan: 02
subsystem: tour-code-open
tags: [vscode.diff, content-provider, navigation]
requires: [06-01]
provides: [src/tour/openCode.ts]
affects: [src/extension.ts, package.json, scripts/smoke-activate.mjs]
key-files:
  created: [src/tour/openCode.ts]
  modified: [src/extension.ts, package.json, scripts/smoke-activate.mjs]
decisions:
  - "Single DiffTourContentProvider registered in registerCodeOpen (restores small-change diffs that lost their provider in 06-01)"
  - "Failure paths (bad args, wrong tourId, missing SHAs) show a warning and open nothing"
metrics: {tasks: 2, tests: "57 pass; smoke ok, 14 commands"}
completed: 2026-11-04
---

# Phase 6 Plan 02: openCode and back-to-step Summary

The Phase 5 openCode stub is replaced by a handler that opens a read-only `vscode.diff` over `difftour-git` documents at the toured SHAs (preview tab, selection at the lines, base-side reveal polled up to 300 ms). Adds context key `difftour.inTourCode`, a "Back to step n" status bar item, editor-title buttons (back/prev/next), palette gating and an Esc keybinding. VSIX rebuilt and reinstalled.

## Tasks
1. openCode handler and navigation: commit "feat(06-02): openCode handler, provider registration, back-to-step navigation"
2. Contributions, smoke, package, reinstall: commit "feat(06-02): back-to-step contributions, smoke coverage"

## Deviations from Plan
None in code. Accepted per CONTEXT: no floating mini-player, lock icon or banner; read-only provenance is in the diff title and status bar.

## Not verified
Live VS Code behaviour (base-side reveal, preview tab reuse, Esc keybinding, editor-title buttons) was not exercised beyond mocked smoke and a successful `code --install-extension`. The smoke only covers the warning/no-diff paths since the fixture meta has no SHAs; the success path of openCode is untested.

## Known Stubs
None.

## Self-Check: PASSED
