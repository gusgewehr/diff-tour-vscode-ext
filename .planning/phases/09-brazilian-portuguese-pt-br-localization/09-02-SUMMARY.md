---
phase: 09-brazilian-portuguese-pt-br-localization
plan: 02
subsystem: extension-host-l10n
tags: [l10n, pt-BR, vscode.l10n, package.nls]
requires: []
provides: [src/l10n.ts translator shim, package.nls*.json, l10n/bundle.l10n.pt-br.json, pt-BR language choice in package.json]
affects: [09-03 (webview string table reuses displayLanguage/setTranslator)]
key-files:
  created: [src/l10n.ts, src/l10n.test.ts, package.nls.json, package.nls.pt-br.json, l10n/bundle.l10n.pt-br.json]
  modified: [package.json, src/extension.ts, scripts/smoke-activate.mjs, src/pick.ts, src/cli/startTour.ts, src/cli/errors.ts, src/cli/detect.ts, src/cli/progress.ts, src/git/changes.ts, src/small/logic.ts, src/small/smallChange.ts, src/tour/controller.ts, src/tour/openCode.ts, src/tour/openPlan.ts, src/tour/enrich.ts, src/views/changesTree.ts, src/views/outlineTree.ts]
decisions:
  - "Pure modules import t() from src/l10n.ts (injectable, vscode-free); vscode-aware modules call vscode.l10n.t directly."
  - "ErrorAction stays an English id; startTour maps ids to translated labels and maps the chosen label back."
metrics:
  tasks: 3
  completed: 2026-11-04
---

# Phase 9 Plan 02: Extension host l10n Summary

Contribution strings go through package.nls(.pt-br).json; every host runtime string goes through `vscode.l10n.t` or the vscode-free `t()` shim, backed by a hand-written pt-BR bundle (about 90 keys) guarded by a coverage test.

## Commits
- 74d0ff0 shim, nls files, pt-BR enum, smoke mock, coverage test
- (task 2) picker, runner, errors, detect, progress, changes
- d0bdbc0 small-change, controller, openCode/openPlan, enrich, trees

## Deviations from Plan
- None functional. `startTour` error handling uses a `switch` on the English id instead of if/else chain (same behavior).
- Left English on purpose: thrown validation errors in `src/tour/model.ts`, `src/tour/open.ts`, `src/git/blob.ts` (not in the plan's file list; they surface only inside "Could not open the tour: {0}"). Also the 'Tour JSON' open-dialog filter name and the output channel/terminal names.

## Verification
`npm run typecheck`, `npm test` (81 pass, includes l10n coverage), `npm run build`, `npm run smoke` all pass.

## Self-Check: PASSED
