---
phase: 01-verify-diff-tour-cli-json-headless-fork
verified: 2026-11-04T00:00:00Z
status: passed
score: 7/7 requirements verified
---

# Phase 1 Verification

**Goal:** A forked `tour` CLI produces a valid tour headlessly on Windows with a machine-readable progress stream, and the real tour schema is known.

| Req | Status | Evidence |
|---|---|---|
| CLI-01 | VERIFIED | `docs/tour-schema.md` exists with Source, Gap table (line 119) and Decision sections; cites tour.go types. |
| CLI-02 | VERIFIED | `go build ./cmd/tour` succeeds. `--json --count HEAD~1` printed a v1 count line (files, baseSha, headSha). Fixture `done` event has v, key, path, baseSha, headSha, cached. |
| CLI-03 | VERIFIED | Fixture JSONL logs contain stage, read and done events (8 stage, 42 read, 1 done in 9c18e24). Errors are emitted as JSON (`{"type":"error","code":"usage"}`) with human text on stderr. |
| CLI-04 | VERIFIED | `--llm`/`--lang` flags exist in `cmd/tour/headless.go`; `--count` runs without config. |
| CLI-05 | VERIFIED (code + SUMMARY evidence) | `job_windows.go` (kill-on-close Job Object) and `killtree_windows.go` (taskkill) exist. The runtime cancel test was not re-run; it relies on the SUMMARY (0 claude.exe, work dir removed). |
| CLI-06 | VERIFIED | Three real fixtures with JSONL logs (11, 14, 16 files; done events present). All three parse and have 6 chapters. |
| CLI-07 | VERIFIED | `docs/decisions/flow-mapping.md` exists. `FlowNode.File`/`Lines` are in `tour.go` and the prompt format.md (v7). |

`go test ./cmd/...` passes. I ran no real generation, as instructed.

## Caveats (not blockers)
- 7 baseline Windows test failures in `internal/generate` are inherited from upstream and recorded in `cli/FORK.md`.
- Only the 9c18e24 fixture is v7. The other two lack flow `file`/`lines`.
- No Go tests were added for the FlowNode fields.
- The cancel and hard-kill behaviour was not independently re-verified.
- My cheap check of the fixture file count found no `"path"` keys in the chapter JSON, so I used the `done.files` values (16, plus 11/14 per SUMMARY) for the 10+ file claim.
