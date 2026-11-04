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
- none
