# Research Summary

**Project:** diff-tour for VS Code
**Researched:** 2026-11-03
**Confidence:** MEDIUM overall

## Executive Summary

The extension is a thin, stateful client over a **forked Go CLI**.
- **Who does what:** the CLI does the LLM work. The extension runs it headlessly, renders its JSON in a Webview, and serves exact git blobs through a read-only `difftour:` provider.
- **Architecture:** a single host-side `TourSession` is the source of truth. The tree, status bar, Webview and flow bar all subscribe to it. The Webview only renders and sends intents. All git and CLI access happens in the extension host through `execFile`/`spawn` with argument arrays, never a shell.
- **Stack:**
  - TypeScript 6 and esbuild with two bundles (host and Webview).
  - Preact for the Webview.
  - `git` called directly, and native VS Code UI wherever it exists.
  - Engine floor `^1.110.0`, with `@types/vscode` pinned to exactly 1.110.0 so vsce packages.

**Upstream schema (read from `internal/tour/tour.go`).** It already has most of what the prototype assumed: `code{file,at,lines,show,note,marks}`, `question`, paragraph `basis`, `snippet` and `flow.nodes`. It also has block types the handoff doesn't list: `diff`, `schema`, `rows` and `pre`. Upstream decodes with `DisallowUnknownFields`, so adding a field means changing the Go struct, the prompts and `PromptVersion` together.

**Gaps a fork or the extension must fill:**
- Headless output. The TTY gate in `run()` makes every non-terminal path fail.
- A machine-readable progress stream. `generate.Generate(..., progress func(Progress))` already emits read, search and repair events. Export needs a callback.
- Flow-node file and line data. Upstream nodes only carry `label, kind, note, next, start`.
- A tour identity and resolved SHAs. The saved `base` and `head` are ref names.
- Finding `weight`, which is needed in v2 only.

**Main risks:**
- The CLI is a TUI, untested on Windows, and spawns `claude` itself.
- Cancelling on Windows leaves the process tree running.
- The flow bar has no upstream data source.
- LLM line references drift.
- The spec's floating "Back to step" player and 48px flow bar can't be drawn over native editors.

**Mitigations:**
- Make an end-to-end headless Windows run the Phase 1 exit gate.
- Pin everything to full SHAs.
- Re-validate code references at load time.
- Use a bottom-panel WebviewView plus status bar items for the flow bar.

## Key Findings

### Stack (see STACK.md)
- VS Code stable 1.144.1. Use engine `^1.110.0`, `@types/vscode` 1.110.0, esbuild 0.28.2, `@vscode/vsce` 4.1.0, `@vscode/test-cli` 0.0.15, `@vscode/test-electron` 3.1.0 and TypeScript 6.0.3.
- Webview: Preact and TSX, `@vscode/codicons`, and `@fontsource` fonts bundled locally. No CDN.
- Don't use the deprecated `@vscode/webview-ui-toolkit`, the old `vscode` npm package, or shell-string `exec`.
- Hand-roll the LCS line alignment, with `diff` 9.0.0 as a fallback.
- Upstream CLI: Go, `go.mod` needs Go 1.27.2 (local is 1.26.1), and flags are parsed with stdlib `flag` in `cmd/tour/main.go`.
  - It runs `claude -p --restricted --tools Read,Grep,Glob --output-format stream-json` with the prompt on stdin.
  - Validation is `tour.Validate()` plus `render.Check()`, with up to 2 repairs.
  - `SaveCached` writes `UserCacheDir/tour/tours/<24-hex key>.json`. The key covers merge-base, head SHA, language, PromptVersion and backend.
  - Real fixtures: `tours/example-coupons.{en,ja,zh,zh-Hant,es,ru}.json`.

### Features (see FEATURES.md)
- **Table stakes:** QuickPick change picker, outline tree, prev/next and keys, persisted progress, `difftour:` provider with native `vscode.diff`, a way back to the step, a cancellable writing view, reopening a cached tour, and the small-change bypass. Side-by-side code blocks with LCS alignment are the largest single item.
- **Differentiators:** the flow bar, basis tags, question/guess blocks, understood marks and notes, copy-only Example snippets, and weighted findings.
- **Anti-features:** auto-applying fixes, writing to the working tree, an in-extension tour editor, a custom diff renderer for opened files, remote assets, and copying prototype code.
- Ship a minimal "CLI not found" notice in v1 even though the setup screen is v2.
- The v2 Inline balloon likely needs a Webview inset, which may not be available to normal extensions. That is a feasibility risk.

### Architecture (see ARCHITECTURE.md)
- `TourSession` holds the event emitter, with subscribers for the outline tree, status bar, Document panel and flow bar.
- Messages use a typed, versioned protocol with a `ready` handshake. The host resolves code text from git and sends it to the Webview.
- `WebviewPanelSerializer` always runs, plus `retainContextWhenHidden` on the Document panel only.
- URIs look like `difftour:/<path>?sha=<fullsha>&side=base|head`, keeping the real filename last for language detection.
- The runner reserves stdout for JSONL and kills the process tree on cancel on Windows.
- The flow bar is a WebviewView in a bottom panel container, plus status bar items and `editor/title` buttons. The floating mini-player is replaced by the status bar, a title button and an Esc keybinding.

### Pitfalls (see PITFALLS.md, 20 items)
- **Windows spawn:** Node won't run a `.cmd` file without a shell (CVE-2024-27980). Use an absolute path, argument arrays and `taskkill /T /F`. Split lines on `\r?\n`.
- **git:**
  - Use `core.quotepath=false` and `-z`.
  - Treat output as Buffers and guard against binary and oversized files.
  - Resolve merge-base once and reuse the SHAs everywhere: count, CLI call, cache key and URIs.
- **`vscode.diff`:** `selection` applies only to the right-hand side, so revealing a base-side line needs a spike. A content provider doesn't give a lock icon. Use `preview` and `preserveFocus` to avoid piling up tabs.
- **Webview:**
  - Use a CSP with a nonce, `font-src` and `localResourceRoots`.
  - Sanitize LLM text against XSS and validate every incoming message.
  - Ignore single-letter shortcuts while a textarea has focus.
  - Map the prototype's oklch colors to `--vscode-*` variables.
- **Tour data:** schema-version the tour and keep the renderer tolerant of unknown blocks. Clamp line ranges and show an "approximate" badge instead of failing.
- **PRs:** show the PR group only when `gh` is on PATH, and never call the GitHub API in v1.

## Disagreements and Recommendations

| Topic | Positions | Recommendation |
|---|---|---|
| Cache ownership | STACK: the CLI owns its cache and the extension reads its path. ARCHITECTURE, PITFALLS and the spec: `globalStorageUri`. | The extension owns `globalStorageUri/tours/` with a `meta.json` per tour. Name files after the CLI `key`, and write to a temp file then rename. |
| Flow node → file | STACK: add `file`/`lines` to `FlowNode` and bump the prompt. Others: derive it from the code blocks. | Sample 3+ real tours in Phase 1 first. If derivation maps poorly, add optional `file`/`lines` in the fork. Keep derivation in `flow.ts` as the fallback. |
| Result delivery | One envelope containing the whole tour, or a file plus its path. | The final JSONL `done` event carries `key`, `path`, the SHAs and `cached`. The extension reads and validates the file. |
| Cancel | Close stdin, or `taskkill`. | Both. Stdin EOF is primary and `taskkill /T /F` is the backstop on Windows. |
| Uncommitted changes | Upstream has a worktree mode. The provider serves commits only. | v1 tours committed changes only, and shows the uncommitted file count as info. |
| Webview persistence | `retainContextWhenHidden`, or re-render from host state. | Always use the serializer with the host's state as truth. Add `retainContextWhenHidden` on the Document panel. |
| Flow bar form | The spec shows a 48px strip. | A 60–90px bottom-panel WebviewView. Accept the deviation. |

## Implications for Roadmap

The user fixed the structure. Phase 1 verifies the CLI and builds the fork. Phases 2–8 follow the spec's build-order steps 1–7.

1. **CLI verify + fork**
   - Add `--json`, `--progress=jsonl`, `--llm` and cancel on stdin EOF. The output carries a protocol version plus `key`, `baseSha` and `headSha`.
   - Exit gate: a real Claude-written tour of a change with 10+ files, run headless on Windows. Collect 3+ real tours as fixtures.
   - Spikes: the Go 1.27.2 toolchain, `claude.cmd` on Windows, killing the process tree.
2. **Skeleton + QuickPick (step 1):** settings, the TOUR container, `git/changes`, the esbuild build and VSIX packaging. Show the PR group only when `gh` is present.
3. **Small-change rule (step 2):** resolve merge-base to full SHAs, count with `-z -M`, and fall back to `vscode.diff` with a notice. This phase is small and could merge into Phase 2.
4. **Runner + Writing + cache (step 3):** `withProgress`, the Writing view, cancel, error classes and an atomic cache write.
5. **Document layout + outline + state (step 4):** `TourSession`, the Webview protocol, a CSP helper, the outline tree, keybindings with `when` clauses, workspaceState and the serializer.
6. **`difftour:` provider + read-only diff (step 5):**
   - SHA URIs with a size and binary guard.
   - Handling for added, deleted and renamed files.
   - "Back to step" through the status bar, a title button and Esc.
7. **Webview blocks (step 6), in this order:**
   - p, list, quote, files, target, table
   - code, with LCS alignment and marks
   - question and guess, snippet, basis tags
   - timeline, flow, schema
   - a fallback for unknown blocks
8. **Flow bar (step 7):** a panel WebviewView plus the status bar. Clicking a node goes to the next step that shows its file, or else opens the file read-only.

**Research flags:** Phases 1, 4, 6 and 8 need deeper research or spikes. Phases 2, 3, 5 and 7 use standard patterns.

## Gaps
- The headless fork hasn't been prototyped, and Go 1.27.2 is untested on this machine.
- Flow data quality on real tours is unknown.
- Not confirmed in source:
  - the accepted values of `code.at`
  - whether `FlowNode.next` is a string or a list
  - the set of `files` roles
- The extension and the CLI must use the same diff semantics (three-dot merge-base).
- Revealing a left-side line in `vscode.diff` and the panel-based flow bar both need spikes.
- Tour state needs a stable key that survives regenerating a tour.
- Font licenses and the CJK fallback are unchecked.
- To limit fork drift, record the fork-point commit and keep the diff small.
