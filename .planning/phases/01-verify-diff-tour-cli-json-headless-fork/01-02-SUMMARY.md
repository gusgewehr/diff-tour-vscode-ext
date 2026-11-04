---
phase: 01-verify-diff-tour-cli-json-headless-fork
plan: 02
subsystem: cli
tags: [go, headless, jsonl, windows]
requires: [01-01]
provides:
  - "tour --json: JSONL v1 protocol, --llm/--lang flags, --count"
  - "Windows cancel: taskkill tree, kill-on-close Job Object, stale sweep"
  - scripts/headless-run.mjs harness
affects: [01-03]
key-files:
  created: [cli/cmd/tour/headless.go, cli/cmd/tour/job_windows.go, cli/cmd/tour/job_other.go, cli/cmd/tour/headless_test.go, cli/internal/generate/killtree_windows.go, cli/internal/generate/killtree_other.go, scripts/headless-run.mjs]
  modified: [cli/cmd/tour/main.go, cli/internal/generate/*.go, cli/FORK.md]
decisions:
  - "--count needs no --lang/--llm (resolved before the language check)"
  - "x/sys was already a direct require; no go.mod change needed"
metrics:
  completed: 2026-11-03
requirements: [CLI-02, CLI-03, CLI-04, CLI-05]
---

# Phase 1 Plan 02: Headless --json mode Summary

`tour --json` emits one v1 JSON object per stdout line (stage, read with BASE/NOT_IN_DIFF tags, repair, done, error, count), bypasses all TTY checks, cancels on stdin EOF or Ctrl+C, and kills the claude tree via taskkill plus a Job Object.

## Commits
- 64b073e: generate package (Event.Tool, checking phase, killTree)
- b26fabb: headless mode in cmd/tour
- bb9ce9f: tests, harness, FORK.md protocol section

## Verification
- `--json --count` prints one count line (files, baseSha, headSha); no-config run gives one `usage` error, exit 1; bad ref gives `git` error; non-json path still returns needTTY; Linux cross-build compiles.
- Two new tests pass. `go test ./...`: only the same 7 baseline `internal/generate` failures.
- Harness run against `--count` printed the line and `exit=0`.
- NOT run: a real Claude generation, cancel, or hard-kill (plan 03).

## Deviations from Plan
- [Rule 1] Positional `{"read", "x"}` literals in generate test files also needed keying after adding `Tool` (perl rewrite).
- --count moved ahead of the lang/llm checks so it works without config (plan acceptance implied this).
- Tasks 1-3 committed separately; the plan's task-3 TDD red commit skipped (speed).

## Known Stubs
None.

## Self-Check: PASSED
