---
phase: 02-extension-skeleton-change-picker
plan: 03
subsystem: packaging
tags: [vsix, smoke]
requires: [02-02]
provides: [scripts/smoke-activate.mjs, README.md, diff-tour.vsix (gitignored)]
key-files:
  created: [scripts/smoke-activate.mjs, README.md]
decisions:
  - "Installed VSIX locally with code CLI; no human check (autonomous)"
metrics:
  tasks: 2
  completed: 2026-11-04
---

# Phase 2 Plan 03: Smoke test and VSIX Summary

`npm run smoke` loads dist/extension.js against a mocked vscode and confirms 6 commands plus the difftour.changes view. `npm run package` builds diff-tour.vsix (4 shipping files: package.json, README.md, dist/extension.js, media/route.svg), non-interactive, and `code --install-extension` installed difftour.diff-tour@0.1.0.

## Deviations from Plan

None. The picker UI was not exercised in a live VS Code window (no human check available).

## Self-Check: PASSED
