---
phase: 01-verify-diff-tour-cli-json-headless-fork
plan: 01
subsystem: cli
tags: [go, fork, schema]
requires: []
provides:
  - cli/ vendored upstream diff-tour at b47b39f, builds on Windows
  - docs/tour-schema.md with gap table
affects: [01-02, 01-03]
key-files:
  created: [cli/, cli/FORK.md, .gitignore, fixtures/tours/example-coupons.en.json, docs/tour-schema.md]
decisions:
  - Keep go 1.27.2 directive (auto toolchain works)
  - Upstream internal/generate has 7 baseline Windows test failures, left unfixed
metrics:
  completed: 2026-11-03
---

# Phase 1 Plan 01: Vendor upstream and tour schema Summary

Upstream diff-tour (b47b39f) copied into `cli/`, `tour.exe` builds with go1.27.2 and runs (`tour dev`), and `docs/tour-schema.md` documents the real schema with a gap table against the prototype.

## Commits
- 14e1318: vendor upstream into cli/, add schema doc (both tasks in one commit)

## Baseline tests
`go test ./...`: all pass except `internal/generate` (7 tests: codex/pi path separators, copilot file mode, gemini path regex, opencode not on PATH, PrepareWorkspace CRLF). Recorded in `cli/FORK.md`. Not fixed. Note TestPrepareWorkspace's CRLF failure is in test comparison only, but worth watching for the export stage.

## Deviations from Plan
None. Both tasks were committed together rather than separately (speed).

## Known Stubs
None.

## Self-Check: PASSED
