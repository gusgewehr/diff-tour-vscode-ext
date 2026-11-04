# diff-tour for VS Code

## What This Is

A VS Code extension that brings [diff-tour](https://github.com/init-co-jp/diff-tour), today a terminal-only Go TUI (`tour`), into the editor. diff-tour asks an LLM CLI to read a git change and write a **tour**: chapters of steps that explain what the change is for, what a reviewer would ask, where to stop and think, and which findings deserve a PR comment. The extension lets a reviewer pick a change, watch the tour being written, walk it step by step, and open the referenced code read-only as a side-by-side before/after diff at the toured commit. It is for day-to-day PR reviewers and people who inherited AI-written code. v1 is for the author and their team, installed from a VSIX.

## Core Value

A reviewer can walk an LLM-written tour of a git change inside VS Code, and every piece of code the tour points to opens read-only, side by side, at the exact commit the tour talks about.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Verify (and where missing, add in a fork) a stable tour JSON and a machine-readable progress stream from the diff-tour CLI before any extension code depends on it
- [ ] Extension skeleton: settings, TOUR view container in the activity bar, `difftour.tourChange` QuickPick (branches, PRs, commits, ranges, saved tours) with file count and outcome per item
- [ ] Small-change rule: under `difftour.minFiles` (default 10) changed files, open VS Code's standard `vscode.diff` instead of calling the LLM, with notice and status bar text
- [ ] Run the CLI with progress (notification + "Writing" Webview with 4 stage cards and a READING NOW log), cancellable, cache the resulting tour JSON
- [ ] Document layout: Webview tour document, outline tree (chapters → steps), prev/next, progress ticks, keyboard (← → U N o Esc), mark as understood, private notes, state per tour in workspaceState
- [ ] `difftour:` read-only content provider (`git show <sha>:<path>`); every code reference opens as side-by-side `vscode.diff` at base/head; "Back to step" mini control
- [ ] Webview blocks: side-by-side code blocks (LCS line alignment, marks, hatched missing side), timeline, flow, schema, table, list, quote, target, files, snippet/EXAMPLE (copy only, never applied), question, guess
- [ ] Flow bar: persistent clickable request-flow strip; click goes to the next step showing that node's file, else opens the file read-only at the node's lines

### Out of Scope

- Focus layout and Inline layout (decorations, CodeLens, gutter badges, balloon) — deferred to v2; Document layout proves the core value first
- PR review comments (GitHub API / GitHub PR extension, pending review, comment dialog, status bar count) — deferred to v2
- First-run Setup screen with LLM detection and sign-in status — deferred to v2; v1 uses settings with Claude Code as the default
- i18n of extension UI — deferred to v2; tour language is passed through to the CLI via `difftour.language`
- Codex, Gemini, Copilot, OpenCode, Pi as tested providers — v1 tests only Claude Code; others may work through the CLI but are not verified
- VS Code Marketplace / Open VSX publishing — v1 ships as a VSIX for the author and team
- Writing to the working tree in any way — tours are read-only by design; Example snippets are never auto-applied
- Copying the prototype HTML/JS as code — `docs/handoff/` files are design references only

## Context

- **Spec:** `docs/handoff/README.md` is the project vision. `docs/handoff/*.dc.html` (clickable prototype, block renderer, variations canvas) and `screenshots/` are design references; `tour-data.js` / `tour-more.js` are a sample 16-step, 5-chapter tour usable as a test fixture. The prototype's sample code (`src/coupons/...`) is not a real repo.
- **Upstream CLI (as of 2026-11-03):** Go, MIT, binary named `tour`. Subcommands/args: `tour` (picker), `tour <branch|commit|base..head>`, `tour <file>.json`, `tour setup`, `--lang`, `--version`; dev flags `--dump`, `--cols`, `--rows`, `--plain`, `--repo`. The LLM writes tour JSON, `tour` validates and saves it to a cache dir (Windows: `%LocalAppData%\tour\tours\`). No documented machine-readable progress stream or headless JSON output. Windows install is "not yet tested" upstream.
- **Prototype assumptions not yet confirmed in the CLI:** per-block `code: { file, at, lines, show?, marks? }`; step `question`; paragraph `basis`; finding `weight`; `flow.nodes` with `kind/file/lines` and step `flowNodes`; `snippet` blocks. The flow ↔ file ↔ step mapping was invented for the prototype.
- **Dev environment:** Windows 11, Node 25, VS Code installed, Claude Code installed; `tour`, Go toolchain status, and `gh` not yet verified/installed.

## Constraints

- **Tech stack**: TypeScript + VS Code Extension API (Webview, TreeView, TextDocumentContentProvider, QuickPick, status bar, `vscode.diff`), bundled with esbuild — spec architecture
- **Native UI first**: use native VS Code UI wherever it exists; Webview only for tour content (prose, diagrams, tables) — follow user theme via `--vscode-*` variables
- **Read-only**: never write to the working tree; code shown is read from git at the toured commit, never copied from the LLM reply
- **CLI dependency**: the extension depends on a fork of diff-tour that adds headless JSON / progress output where upstream lacks it
- **Offline Webview**: fonts and assets bundled locally, no network from the Webview
- **Platform**: must work on Windows (author's machine); upstream CLI's Windows support is untested
- **LLM**: Claude Code is the only provider tested in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork the diff-tour CLI for missing JSON/progress output | Extension needs a headless, machine-readable interface; don't block on upstream | — Pending |
| v1 = build-order steps 1–7 | Document layout + read-only diffs + flow bar deliver the core value; Focus/Inline, PR comments, setup, i18n wait | — Pending |
| Claude Code only for v1 testing | Only provider installed; spec marks it RECOMMENDED | — Pending |
| VSIX distribution for author/team | No marketplace overhead until the core is proven | — Pending |
| Phase 1 verifies CLI JSON before anything else | Every later phase consumes the tour JSON schema | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-11-03 after initialization*
