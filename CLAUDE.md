<!-- GSD:project-start source:PROJECT.md -->
## Project

**diff-tour for VS Code**

A VS Code extension that brings [diff-tour](https://github.com/init-co-jp/diff-tour), today a terminal-only Go TUI (`tour`), into the editor. diff-tour asks an LLM CLI to read a git change and write a **tour**: chapters of steps that explain what the change is for, what a reviewer would ask, where to stop and think, and which findings deserve a PR comment. The extension lets a reviewer pick a change, watch the tour being written, walk it step by step, and open the referenced code read-only as a side-by-side before/after diff at the toured commit. It is for day-to-day PR reviewers and people who inherited AI-written code. v1 is for the author and their team, installed from a VSIX.

**Core Value:** A reviewer can walk an LLM-written tour of a git change inside VS Code, and every piece of code the tour points to opens read-only, side by side, at the exact commit the tour talks about.

### Constraints

- **Tech stack**: TypeScript + VS Code Extension API (Webview, TreeView, TextDocumentContentProvider, QuickPick, status bar, `vscode.diff`), bundled with esbuild — spec architecture
- **Native UI first**: use native VS Code UI wherever it exists; Webview only for tour content (prose, diagrams, tables) — follow user theme via `--vscode-*` variables
- **Read-only**: never write to the working tree; code shown is read from git at the toured commit, never copied from the LLM reply
- **CLI dependency**: the extension depends on a fork of diff-tour that adds headless JSON / progress output where upstream lacks it
- **Offline Webview**: fonts and assets bundled locally, no network from the Webview
- **Platform**: must work on Windows (author's machine); upstream CLI's Windows support is untested
- **LLM**: Claude Code is the only provider tested in v1
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Part A: Extension stack
### Core
| Technology | Version | Purpose | Why |
|---|---|---|---|
| VS Code engine | `"vscode": "^1.110.0"` (pin low; see note) | Min supported host | Stable is 1.144.1. Nothing used here (Webview, TreeView, TextDocumentContentProvider, `vscode.diff`, QuickPick, `withProgress`) is newer than ~1.80. Use a floor ~30 minor versions behind so teammates on older builds can install the VSIX. |
| `@types/vscode` | `1.110.0` (exactly equal to the engine floor) | API typings | vsce **refuses to package** if `@types/vscode` is newer than `engines.vscode`. It also stops you from using APIs newer than your floor. Latest on npm is 1.144.0; do not use it unless you raise the engine to match. |
| TypeScript | `^6.0.3` for tsc type-check only | Language | `latest` on npm is 7.0.2 (native port). I did not verify the VS Code toolchain (`@vscode/test-cli`, eslint typescript plugin) against 7.x. 6.0.3 is the safe choice. Try 7 later as an isolated experiment (`tsc --noEmit` is the only consumer). Confidence MEDIUM. |
| esbuild | `^0.28.2` | Bundle extension host + Webview | Spec says esbuild. Two entry points: `src/extension.ts` (platform node, cjs, `external: ['vscode']`) and `src/webview/ui/main.tsx` (platform browser, iife, minify). It does not type-check, so run `tsc --noEmit` separately. |
| Node (host) | Whatever VS Code ships (Electron's Node) | Runtime | Target `node22` in esbuild. Dev machine is Node 25, but that only matters for tooling. |
| `@vscode/vsce` | `^4.1.0` (needs Node >= 22) | Package VSIX | Standard. Use `vsce package --no-dependencies` because esbuild bundles everything. Needs a `.vscodeignore` that drops `src/`, `node_modules/`, maps, `docs/`. |
### Webview UI
| Technology | Version | Purpose | Why |
|---|---|---|---|
| Preact + TSX | `^11.1.1` (npm latest; MEDIUM, check that 10.x vs 11.x API matches docs) | Tour document renderer | The tour is a tree of ~14 block types rendered from JSON, plus local state (guess textarea, understood, notes, flow bar highlight). Components per block type map 1:1 to the prototype's `Tour Blocks.dc.html`. Preact is ~4 KB, has no VS Code coupling, and esbuild does JSX natively (`jsx: 'automatic'`, `jsxImportSource: 'preact'`). Plain TS string templates would work but make the stateful blocks (question/guess, flow bar) painful and XSS-prone. |
| `@vscode/codicons` | `0.0.46-24` (pre-release tag is what npm `latest` points to) | Icons in Webview | Copy `codicon.css` + `codicon.ttf` into `media/` and load via `webview.asWebviewUri`. Offline-safe. Same icon set as the native UI. |
| `@fontsource/newsreader`, `@fontsource/fira-code`, `@fontsource/ibm-plex-sans` | latest | Bundled fonts | The spec requires offline fonts. Copy only the `latin-400/500/600 woff2` files into `media/fonts` and `@font-face` them. Keep `--vscode-font-family` / `--vscode-editor-font-family` as defaults and use the serif only for prose. Skip IBM Plex Sans unless the design needs it: native UI font is acceptable. |
| Webview CSP | n/a | Security | Per-load nonce, `default-src 'none'; style-src ${cspSource}; script-src 'nonce-…'; font-src ${cspSource}; img-src ${cspSource} data:`. Set `localResourceRoots` to `media/` and `dist/` only. `retainContextWhenHidden: false` plus `getState/setState` plus extension-side `workspaceState` as truth. |
### Content provider and diff (no library needed)
| Piece | Choice | Why |
|---|---|---|
| Read-only content | `workspace.registerTextDocumentContentProvider('difftour', …)`, URI `difftour:/<path>?sha=…&side=…` | Content providers are read-only by construction, so the editor shows the lock. Run `git show <sha>:<path>` through `child_process.execFile` (never `exec`, no shell) with `maxBuffer` raised (>= 16 MB). Missing file (new or deleted side) returns an empty string, and the UI marks the hatched side. Fire `onDidChange` only if the sha is a moving ref (it should not be: always resolve to a full sha first). |
| Side-by-side | `commands.executeCommand('vscode.diff', left, right, title, { selection, preview: true })` | Built-in. |
| Git access | Spawn `git` directly. Do **not** depend on the `vscode.git` extension API. | You only need `rev-parse`, `diff --name-status`, `show`, `branch`, `log`. The git extension API is optional and it changes. `gh` is needed only in v2. |
| Webview line alignment (LCS) | **Hand-roll** ~40 lines: Myers/LCS on the two `lines` arrays of a single code block, ranges are tiny (tens of lines). | Per-block inputs are small and the prototype already has `splitRows/align` to port. `diff@9.0.0` (`diffArrays`) is the fallback if the hand-rolled version has edge-case bugs. Not worth a dependency up front. Add a unit test with the sample fixture. |
| Syntax highlighting inside Webview blocks | Defer. Start monochrome with the `--vscode-editor-*` colors. | Real highlighting means shipping shiki/Textmate grammars, which is heavy. The spec only says "use the user's theme in the editor". Revisit after v1 (Shiki with `vscode-textmate` is the later option). |
### CLI integration (extension side)
| Piece | Choice | Why |
|---|---|---|
| Spawn | `child_process.spawn(tourPath, args, { cwd, windowsHide: true })` with no `shell: true` | On Windows `.cmd` shims need a shell, but `tour` is a native `.exe`, so no shell. Path from setting `difftour.cliPath` (default: `tour` on PATH). |
| Progress | Read stdout as JSONL with `readline` | See Part B protocol. |
| Cancel | `CancellationToken` -> kill child. On Windows `child.kill()` terminates the `tour` process only, and the Go side's `exec.CommandContext` won't get to run cleanup; also use `taskkill /pid <pid> /T /F` (or a Go-side `--cancel-on-stdin-close`: closing stdin is more robust, see Part B). | `claude` is a grandchild process. |
### Testing
| Technology | Version | Purpose | Why |
|---|---|---|---|
| `@vscode/test-cli` | `^0.0.15` | Runner (`.vscode-test.mjs`) | Official; wraps test-electron, uses mocha. |
| `@vscode/test-electron` | `^3.1.0` | Downloads and launches VS Code | Required by test-cli. |
| mocha / `@types/mocha` | `^11.7.6` (test-cli's own dep) / `^10.0.10` | Test framework | Comes with test-cli. |
| Pure-logic tests (LCS, flow mapping, tour model parsing, JSONL parser) | `node:test` via `tsx`, or mocha without VS Code | Fast tests that don't need Electron | Keep these modules free of `import 'vscode'` so they run outside Electron. Reserve Electron tests for the content provider and command wiring. |
| ESLint | `^10.14.0` + `typescript-eslint` | Lint | Optional. Flat config only. |
### Do NOT use
| Thing | Why not |
|---|---|
| `@vscode/webview-ui-toolkit` | Deprecated by Microsoft (npm marks it deprecated, issue #561). It's Fast-based web components. Use plain CSS with `--vscode-*` variables. |
| `vscode` npm package (1.1.37) | Ancient; replaced by `@types/vscode`. |
| `webpack` / `yo code` scaffolding with webpack | Spec says esbuild. Use `npm create vscode` only as a reference. |
| `@octokit/rest`, GitHub auth | v2 (PR comments). Out of scope. |
| `exec()` / shell strings for git or tour | Quoting bugs on Windows and injection through branch names. |
| Copying prototype `.dc.html`/`support.js` | Spec: design reference only. |
| React / large frameworks in Webview | Overkill. Preact suffices. |
| Webview remote fonts/CDN | Offline constraint. |
### Installation
## Part B: Forking the Go CLI (verified by reading upstream source)
### Upstream facts (HIGH, from source at HEAD 2026-11-02)
- Module `github.com/init-co-jp/diff-tour`, **`go 1.27.2`** in `go.mod`, `mise.toml` says `go = "1.27"`. The local Go is 1.26.1. With `GOTOOLCHAIN=auto` (default since 1.21) Go will download 1.27.2 on first build; confirm it works on this machine (needs network) or install Go 1.27.x. Deps: bubbletea v2, chroma, `modernc.org/sqlite` (pure Go, so no cgo, which is good for Windows).
- Layout: `cmd/tour/main.go` (296 lines; stdlib `flag`, no cobra) and `internal/{config,generate,git,highlight,i18n,render,schema,text,tour,ui}`.
- **Flag parsing**: `run()` in `cmd/tour/main.go`; flags declared with `flag.NewFlagSet`. `parse()` handles flags mixed with positionals. `--dump` already exists but prints rendered TUI text, not JSON.
- **Non-TTY gate**: `isTerminal()`; both the generate path and the `setup` path return `needTTY` error if stdin/stdout aren't a terminal. A headless mode must bypass this. This is the single biggest blocker for the extension: today the generate path always ends in `tea.NewProgram(app).Run()`.
- **Config**: `internal/config/config.go`, `os.UserConfigDir()/tour/config.json` = `{lang, llm}` where llm is one of `claude-code|codex|gemini|opencode|copilot|pi`. If missing, `cfg == nil` triggers the interactive setup. Headless mode needs an `--llm` flag (and `--lang`, which already exists) so no TUI setup runs. `backendFor(llm)` in main.go already maps the names.
- **Ref resolution**: `resolve(repo, arg)` in main.go returns `(base, head)` for `a..b`, branch (vs default branch), or single commit (`arg^`..`arg`). Reusable as is. `git.Worktree` is a sentinel for head = uncommitted working tree. Notice: base/head in the saved tour are names (e.g. `main`, `feature/x`), **not shas**; the extension must `rev-parse` them itself to build `difftour:` URIs, and a branch can move between generation and viewing. Add resolved `baseSha`/`headSha` to the output (see below).
- **Generation entry point**: `generate.Generate(ctx, backend, req, workDir, progress func(Progress)) (*tour.Tour, Stats, error)` in `internal/generate/generate.go`. It: `PrepareWorkspace` (git archive of base and head into `workDir`, plus `change.diff`, `commits.txt`, `lessons/`), builds the prompt, runs the backend, `extractJSON`, decodes with `DisallowUnknownFields`, `Validate()`, `render.Check()` (files and lines exist), and repairs up to `MaxRepairs = 2` times. `Progress{Event *Event, Phase "reading"|"repairing", Repair int}`; `Event{Kind "read"|"search", Detail}`. This maps almost directly onto the 4 stage cards and READING NOW log.
- **LLM call**: `generate.Backend` interface (`Name()`, `Run(ctx, dir, prompt, events)`). `internal/generate/claude.go` runs `claude -p --restricted --strict-mcp-config --tools Read,Grep,Glob --permission-mode dontAsk --permission-prompts none --no-session-persistence --output-format stream-json --verbose` with the prompt on **stdin** (explicitly to dodge the Windows cmd.exe 8191-char limit, so upstream has thought about Windows `claude.cmd`). It parses `assistant` `tool_use` events (Read -> `read`, Grep/Glob -> `search`) and the final `result` (text + `total_cost_usd`). Other backends have the same shape (codex, gemini, opencode, copilot, pi).
- **Where the JSON is validated and saved**: validation = `tour.(*Tour).Validate()` in `internal/tour/tour.go` plus `render.Check` in `internal/render/check.go`. Save = `generate.SaveCached(key, t)` -> `os.UserCacheDir()/tour/tours/<key>.json` (`key = CacheKey(repo, base, head, lang, backendName)`, 24 hex chars of sha256 over merge-base, head sha, lang, `PromptVersion` ("v6"), backend). On Windows that is `%LocalAppData%\tour\tours\`. Work dir: `UserCacheDir/tour/work/<key>`. Saved with `json.MarshalIndent`. `LoadCached(key)` returns nil when absent.
- **Where the TUI calls generation**: `internal/ui/app.go` `(*App).start()` runs `Generate` in a goroutine, then `SaveCached`. This is the logic to mirror in the headless path (check cache, generate, save, emit).
- **Windows**: `os.UserCacheDir`/`UserConfigDir` are used, and the Claude invocation already considers Windows. Windows is "not tested" upstream; plan on a smoke test early (git archive extraction, path separators in `Show`).
### Tour JSON schema as Go types (`internal/tour/tour.go`, `Version = 1`) (HIGH)
### Gap analysis: prototype assumptions vs upstream schema (HIGH)
| Prototype assumes | Upstream reality | Consequence |
|---|---|---|
| `code: {file, at, lines, show?, marks?}` | **Exists, identical** (plus `note`). | No fork work. |
| step `question: true` | **Exists.** | None. |
| paragraph `basis` | **Exists** (`fact|inferred|opinion`). | None. |
| `snippet {label,text}` | **Exists** (+`lang`). | None. |
| finding `weight` (Must/Suggestion/…) | **Missing.** No weight anywhere. | v2 (PR comments) only. Do not add to the fork for v1. |
| `flow.nodes[].file/lines/id` | **Missing.** Flow nodes have only `label,kind,note,next,start`. | **Flow-bar blocker.** Derive in the extension: match a node to a file by the label heuristics is fragile. Better: add optional `file`, `lines` to `FlowNode` in the fork, and update `prompts/` plus bump `PromptVersion` to "v7" (this invalidates cached tours). `DisallowUnknownFields` means the extension's new fields must be added to the Go struct or the LLM output is rejected. |
| step `flowNodes: [id]` | **Missing.** | Derive in the extension: a node's steps = steps whose `code` blocks reference the node's `file` (spec already allows this). No Go change if `FlowNode.file` is added. |
| Tour has no id | No `id`; identity = cache key. | The fork should emit `key` (and resolved `baseSha`/`headSha`) in its output envelope. The extension keys workspaceState by that key. |
### Fork additions (minimal, ordered)
### Go fork toolchain
| Item | Choice |
|---|---|
| Go | 1.27.2 per `go.mod` (auto-toolchain download from local 1.26.1, or install 1.27.x; verify). |
| Build | `go build -o tour.exe ./cmd/tour` (pure Go, no cgo). Set `-ldflags "-X main.version=<x>"`. |
| Distribution | Ship the `tour.exe` next to the VSIX docs or point `difftour.cliPath` at it. Do not bundle in the VSIX for v1 (platform-specific VSIX complexity). |
| Layout | Separate repo (or `cli/` git subtree) of the fork. Track `upstream` remote and rebase. |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|---|---|---|---|
| Webview UI | Preact + TSX | Plain TS, Lit, React | Plain TS: stateful blocks get messy. Lit: fine but custom-element/shadow-DOM theming friction with `--vscode-*` is mild; no real advantage. React: 10x the size. |
| Headless data source | Fork with `--json`/jsonl | Scrape `--dump --plain` or tail the cache dir | `--dump` is rendered text, not the data. Cache polling gives no progress. |
| Cache location | Let the CLI own its cache, extension reads `path` from the envelope | Extension copies to `globalStorageUri/tours/…` as the spec says | Spec says `globalStorageUri`. Simplest: CLI writes the cache; extension copies the final JSON into `globalStorageUri/tours/<repo>/<key>.json` only if saved-tour listing needs per-repo grouping. Decide in the roadmap; both work. |
| Git | Spawn `git` | `vscode.git` API / `simple-git` | Extra coupling or dependency for 6 commands. |
| Bundler | esbuild | tsup, webpack | Spec says esbuild. |
| TS | 6.0.x | 7.0.2 | Tooling compat unverified. |
## Confidence
| Item | Level | Note |
|---|---|---|
| Package versions (esbuild, vsce, test-cli, test-electron, TS, preact, codicons) | HIGH | `npm view` today |
| `@types/vscode` must equal/lower than engine | HIGH | well-known vsce behavior (not re-verified this session) |
| Preact 11 specifics | MEDIUM | version verified, API details not read |
| TS 6 vs 7 recommendation | MEDIUM | judgment, untested |
| Upstream structure, flags, schema, cache, Claude invocation | HIGH | read from source |
| Fork design (envelope, jsonl events, cancel) | MEDIUM | design proposal, not yet prototyped; Windows process-tree kill needs a spike |
| Go 1.27.2 toolchain download works here | LOW | not tried |
## Sources
- Upstream clone: `cmd/tour/main.go`, `internal/tour/tour.go`, `internal/generate/{generate,claude}.go`, `internal/render/check.go`, `internal/config/config.go`, `internal/ui/app.go`, `go.mod`, `mise.toml`, `tours/` (github.com/init-co-jp/diff-tour, 2026-11-02)
- npm registry: `npm view` for @types/vscode, esbuild, @vscode/vsce, @vscode/test-cli, @vscode/test-electron, typescript, preact, diff, @vscode/codicons (2026-11-03)
- VS Code releases API: https://update.code.visualstudio.com/api/releases/stable (latest 1.144.1)
- Deprecation notice: https://github.com/microsoft/vscode-webview-ui-toolkit/issues/561
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
