# Phase 1: Verify diff-tour CLI JSON + headless fork - Context

**Gathered:** 2026-11-03
**Status:** Ready for planning
**Mode:** Autonomous (decisions made by Claude per user instruction: speed over polish, never ask the user)

<domain>
## Phase Boundary

Know the real tour JSON schema, and have a forked `tour` CLI that writes a tour headlessly on Windows with a JSONL progress stream. No VS Code extension code in this phase.

</domain>

<decisions>
## Implementation Decisions

### Fork location and drift
- Copy upstream `github.com/init-co-jp/diff-tour` source into `cli/` in this repo, with no nested `.git`. Clone it to the scratchpad or a temp dir, then copy it over.
- `cli/FORK.md` records the upstream commit hash, date, and a list of every change. Keep the diff small.
- Build with `go build -o cli/bin/tour.exe ./cmd/tour` (the binary is gitignored). `GOTOOLCHAIN=auto` fetches Go 1.27.2 if the local 1.26.1 is too old. If that fails, lower the `go` directive in the fork's `go.mod` to 1.26 and note it in FORK.md, unless 1.27-only language features break the build.

### Headless interface (one switch)
- `tour --json --llm <backend> --lang <code> [--repo <path>] <target>`, where target is `<branch>`, `<commit>` or `<base>..<head>`.
- `--json` skips the TTY check and the Bubble Tea UI. It also skips the interactive setup: if config is missing, `--llm` and `--lang` are required, and their absence is an `error` event.
- stdout is JSONL only, one event per line, every event carrying `"v":1`:
  - `{"v":1,"type":"stage","stage":"export|write|check|show","state":"active|done"}`
  - `{"v":1,"type":"read","tool":"Read|Grep|Glob","path":"...","tag":"NOT_IN_DIFF|BASE|"}`
  - `{"v":1,"type":"repair","attempt":1}`
  - `{"v":1,"type":"done","key":"<24hex>","path":"<abs path to tour json>","base":"<ref>","head":"<ref>","baseSha":"<full>","headSha":"<full>","files":N,"cached":bool}`
  - `{"v":1,"type":"error","code":"not_signed_in|invalid_tour|git|cancelled|llm|usage","message":"..."}` and a non-zero exit code.
- Human-readable logs go to stderr.
- A cached tour short-circuits to a `done` event with `cached:true`.
- Events are written synchronously, so none are dropped (unlike the TUI's non-blocking send).
- Add `tour --json --count <target>`. It prints one `{"v":1,"type":"count","files":N,"baseSha":..,"headSha":..}` line, so the extension and CLI count files the same way (merge-base three-dot).

### Cancellation
- Stdin EOF, or SIGINT/CTRL_BREAK, cancels the context.
- On Windows, cancelling kills the LLM child's process tree (`taskkill /T /F /PID <pid>`) and removes the export dir. Emit `error` with code `cancelled`.

### Fixtures and verification
- Copy upstream `tours/example-coupons.en.json` to `fixtures/tours/`.
- Generate at least 3 real tours with Claude Code, headless on Windows, for ranges with 10 or more files. Use the upstream diff-tour repo history (clone in scratchpad) and pick ranges via `git log --stat`. Save them to `fixtures/tours/real-*.json`, along with the JSONL progress logs (`*.progress.jsonl`).
- If generation fails because Claude isn't signed in or credits run out, wait and retry. Do not skip.

### Schema doc
- `docs/tour-schema.md` covers the Go types in `internal/tour/tour.go`, the block types, the allowed `at` values, `FlowNode` (`next` type), and the `files` roles.
- It includes a gap table against `docs/handoff/tour-data.js` / README assumptions.

### Flow mapping decision (CLI-07)
- Default: derive in the extension. A node's file is the code-block file whose path or basename best matches the node label. A node's steps are the steps whose code blocks reference that file.
- After sampling the real tours, write the decision to `docs/decisions/flow-mapping.md`. If fewer than about 60% of nodes map, add optional `file`/`lines` (omitempty) to `FlowNode` in the fork and its prompt instead. Bump `PromptVersion` and regenerate one fixture.
- Prefer derivation for speed.

### Claude's Discretion
- Go code structure inside the fork.
- How the export-stage callback is added.
- Minimal Go tests: one for event encoding, one for the TTY bypass. Nothing more.

</decisions>

<code_context>
## Existing Code Insights

- Upstream layout comes from the research (`.planning/research/STACK.md`, `ARCHITECTURE.md`):
  - `cmd/tour/main.go` uses stdlib `flag`.
  - `run()` has an `isTerminal()` gate.
  - Packages are `internal/{tour,generate,render,git,config,ui}`.
  - Generation is `generate.Generate(ctx, backend, req, workDir, progress func(Progress))`.
  - `PrepareWorkspace` handles export.
  - `tour.Validate()` and `render.Check()` run with up to 2 repairs.
  - `SaveCached` writes `UserCacheDir/tour/tours/<key>.json`.
- The Claude backend runs `claude -p --restricted --tools Read,Grep,Glob --output-format stream-json`, with the prompt on stdin.
- This repo has no code yet. `docs/handoff/` holds design references.

</code_context>

<specifics>
## Specific Ideas

- Claude Code is installed at `C:\Users\gusge\.local\bin\claude`. Windows 11, Git Bash available, Node 25, Go 1.26.1.
- Keep all work local. No GitHub pushes or forks on github.com.

</specifics>

<deferred>
## Deferred Ideas

- Other backends (codex, gemini, opencode, copilot, pi) are not tested in v1.
- Finding `weight` in the schema is v2 (PR comments).

</deferred>
