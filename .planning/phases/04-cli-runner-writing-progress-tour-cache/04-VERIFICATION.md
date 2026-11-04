---
phase: 04-cli-runner-writing-progress-tour-cache
status: passed
verified: 2026-11-04
---

# Phase 4 verification

Checked by the orchestrator in autonomous mode. The evidence is from typecheck, tests, the smoke test and greps over the source. No live VS Code session was run, and no real tour was generated (fake-tour replays real fixtures instead).

| Req | Evidence | Status |
|-----|----------|--------|
| WRITE-01 | `src/cli/startTour.ts` shows a cancellable `withProgress` notification and a `$(sync~spin)` status item, and the run is non-blocking | ✓ |
| WRITE-02 | `src/cli/progress.ts` reducer feeds the 4 stage cards in `src/webview/writing/main.ts`. A replay test runs it against a real progress fixture | ✓ |
| WRITE-03 | READING NOW log in the Writing view is newest first, capped at 200 entries, with NOT IN DIFF and BASE tags | ✓ |
| WRITE-04 | EXPORT DIRECTORY card in the Writing view | ✓ |
| WRITE-05 | `runner.ts` cancels by closing stdin, then runs `taskkill /T /F` after 3 s. Tests cover cancel on stdin EOF and forced kill | ✓ |
| WRITE-06 | `cache.ts` writes atomically (tmp file, then rename) to `globalStorage/tours/<key>.json` plus `.meta.json`. "Your tour is ready" then opens the tour through `openSavedTour(path)` | ✓ |
| WRITE-07 | `errors.ts` maps each error code to a message and actions. Unit-tested | ✓ |
| WRITE-08 | The "Skip to the tour" button shows when a saved tour with the same label or SHAs exists | ✓ |

Checks: typecheck clean, `npm test` 30/30, smoke reports "8 commands, 2 views", VSIX packaged and installed.

Unchecked: the end-to-end flow with a real CLI inside VS Code.
