# Fork of diff-tour

## Upstream
- Repo: https://github.com/init-co-jp/diff-tour
- Commit: b47b39f05ff66101a9066292e38d17b0cedda9db ("Write tours with Pi too")
- Commit date: 2026-11-02
- Copied on: 2026-11-03 (source only, no .git)

## Build
`cd cli && go build -o bin/tour.exe ./cmd/tour` with go1.27.2 windows/amd64 (GOTOOLCHAIN=auto; go.mod directive unchanged).
`bin/tour.exe --version` prints `tour dev`.

## Baseline tests
`go test ./...` on Windows: all packages pass except `internal/generate`, which fails 7 tests,
all Windows path/permission/environment issues (not fixed, baseline):
TestReadCodexStream, TestCommandEvent, TestPiStream (backslash vs slash paths),
TestPrepareCopilotHome (file mode), TestGeminiOutsideRules (path regex),
TestFindOpenCode (no opencode on PATH), TestPrepareWorkspace (CRLF in git output).
Later plans must add no new failures.

## Changes
- internal/generate/*.go: `Event` gains `Tool`; positional `Event{...}` literals made keyed (tests too)
- internal/generate/claude.go: Tool name on events; `cmd.Cancel` kills the process tree, `WaitDelay` 10s
- internal/generate/generate.go: `Progress{Phase: "checking"}` before each parse
- internal/generate/killtree_windows.go, killtree_other.go: `taskkill /T /F` tree kill (Kill elsewhere)
- cmd/tour/main.go: `--json`, `--llm`, `--count` flags; early branch to `runHeadless` before any TTY check
- cmd/tour/headless.go: JSONL emitter, tag/error classification, stdin/signal cancel, --count, stale work dir sweep (>1h)
- cmd/tour/job_windows.go, job_other.go: kill-on-close Job Object for tour.exe's children
- cmd/tour/headless_test.go: event encoding/tag test, TTY bypass test
- go.mod: golang.org/x/sys now a direct require (no new module)
- ../scripts/headless-run.mjs (outside cli/): Node harness spawning tour.exe like the extension (stdin pipe, no shell)

## Headless protocol v1
`tour --json [--llm X] [--lang L] [--repo P] <target>`; callers must keep stdin open for the whole run (EOF = cancel; Ctrl+C/Break also cancels).
One JSON object per stdout line, always `"v":1` and `"type"`; human text only on stderr.
- `stage` {stage: export|write|check|show, state: active|done}
- `read` {tool, path, tag: ""|NOT_IN_DIFF|BASE}
- `repair` {attempt}
- `done` {key, path, base, head, baseSha, headSha, files, cached}
- `error` {code: usage|git|not_signed_in|cancelled|invalid_tour|llm, message, problems? (invalid_tour)}; exit code 1
- `count` (with `--count`, no LLM) {files, base, head, baseSha, headSha}
