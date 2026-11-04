# Phase 2: Extension skeleton + change picker - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions per user instruction (speed over polish, never ask the user).

<domain>
## Phase Boundary

A VS Code extension that installs from a VSIX and lets the user pick a change to tour from a grouped QuickPick and an activity-bar tree.

Picking an item resolves a target with full SHAs and file count, then routes it:
- under minFiles → Phase 3 handler
- otherwise → Phase 4 runner

Both handlers are stubs in this phase. Each one shows an info message naming the target and its file count.

</domain>

<decisions>
## Implementation Decisions

### Project layout and stack
- The extension lives at the repo root: `package.json`, `src/`, `media/`, `dist/`. `cli/` (the Go fork) stays where it is.
- Use TypeScript and esbuild. Bundle `src/extension.ts` into `dist/extension.js`, CommonJS, `external: ['vscode']`.
- Engine `^1.110.0`, `@types/vscode` exactly `1.110.0`.
- Package with `@vscode/vsce package --no-dependencies`. `.vscodeignore` excludes `src`, `cli`, `fixtures`, `.planning`, `docs` and `node_modules`.
  - It keeps `cli/bin/tour.exe` out of the VSIX for now. The CLI path is configured instead.
- Tests: use `node --test` for the pure modules (git output parsing, grouping, base detection). Compile them with esbuild or tsx. No extension-host test harness in v1.
- Module paths follow the spec architecture: `src/git/changes.ts`, `src/cli/detect.ts`, `src/views/changesTree.ts`, `src/pick.ts`, `src/extension.ts`.

### Commands and keybinding
- `difftour.tourChange`, titled "diff-tour: Tour a change".
- Keybinding `ctrl+alt+t` on Windows and Linux, `cmd+alt+t` on macOS. It doesn't shadow a default VS Code binding. ⇧⌘T / Ctrl+Shift+T is "Reopen Closed Editor".
- `difftour.refreshChanges` refreshes the tree.

### Base branch and changes
- `difftour.baseBranch` setting, default empty, meaning auto. Auto tries these in order and uses the first that exists:
  1. `git symbolic-ref --short refs/remotes/origin/HEAD`, with `origin/` stripped
  2. `main`
  3. `master`
- Every target is resolved to full SHAs:
  - `baseSha = git merge-base <base> <head>`
  - `headSha = git rev-parse <head>`
- Count files with `git diff --name-only -z <baseSha> <headSha>`, three-dot semantics via merge-base. This matches the CLI `--count`.
- Run git with `child_process.execFile('git', args, { cwd })`, never a shell. Use `core.quotepath=false`.
- Group "COMPARED WITH <base>":
  - **Current branch.** Committed only. Its detail notes "+N uncommitted (not toured)" when `git status --porcelain` has entries.
  - **Other local branches.** Sorted by committer date, at most 15, excluding the base itself.
- **PRs with review requested.** Only shown if `gh` is on PATH, via `gh pr list --search "review-requested:@me" --json number,title,headRefName,baseRefName --limit 20`. If `gh` is missing or the call fails, the group is hidden silently.
  - A PR head is resolved via `git fetch origin pull/<n>/head` only when picked. If the fetch fails, show an error.
- **SAVED group.** Lists `*.meta.json` under `context.globalStorageUri/tours/`. The cache is written in Phase 4. An empty dir means an empty group, with a "No saved tours yet" item that cannot be picked.
- **OTHER group:**
  - "A single commit…" opens a QuickPick of the last 50 commits (`git log -50 --format=%H%x00%s%x00%cr`). The target is `<sha>^..<sha>`.
  - "A range…" opens an InputBox validating `<base>..<head>` via `git rev-parse`.
  - "A saved tour file…" opens `showOpenDialog` for `*.json`. It routes to the Phase 5 open handler (a stub now).
- Item description: `14 files · tour` or `3 files · opens git diff`, using `difftour.minFiles`.
- QuickPick placeholder or title footer text: "A new tour takes 2 to 5 minutes. A saved tour opens instantly and costs nothing."
- File counts compute in parallel, capped at about 6 concurrent git calls. The QuickPick shows `busy` while counts load, and items update as counts arrive.

### TOUR view container
- Activity bar container `difftour` with a custom `media/route.svg` icon: a simple monochrome route/path glyph, 24x24, using `currentColor`.
- Tree view `difftour.changes` with the same groups as collapsible nodes. Clicking an item runs the same routing.
- Title-bar buttons: refresh (`$(refresh)`) and tour a change (`$(git-compare)`).

### Settings
- `difftour.language`: enum `en`, `ja`, `zh`, `zh-Hant`, `es`, `ru`. Default empty, which derives from `vscode.env.language` (pt or others fall back to `en`).
- `difftour.llm`: enum `claude`, `codex`, `gemini`, `opencode`, `copilot`, `pi`. Default `claude`.
- `difftour.minFiles`: number, default 10, minimum 1.
- `difftour.cliPath`: string, default empty. Empty means:
  1. the workspace-or-extension-relative `cli/bin/tour.exe` (dev)
  2. `tour` on PATH, resolved with `where` / `which`
- `difftour.baseBranch`: as above.

### CLI / LLM detection (PICK-07)
- `src/cli/detect.ts` resolves the CLI path and runs `<cli> --version` (execFile, 5s timeout).
- It resolves Claude Code with `where claude` on Windows or `which claude`.
- If either is missing when the user picks a change that needs a tour, show an error notification naming what is missing.
  - Buttons: "Open Settings" (`difftour.cliPath`) and "How to install".
  - "How to install" opens `cli/FORK.md` if present, else shows build instructions: `go build -o cli/bin/tour.exe ./cmd/tour`.
- Small changes (Phase 3 route) don't need the CLI.

### Routing contract (consumed by Phases 3–5)
- A resolved target is `{ label, base, head, baseSha, headSha, files: number, kind: 'branch'|'pr'|'commit'|'range' }`, defined in `src/git/changes.ts`.
- `src/extension.ts` registers internal commands with stub bodies for now:
  - `difftour.internal.openSmallChange(target)`
  - `difftour.internal.startTour(target)`
  - `difftour.internal.openSavedTour(pathOrKey)`

### Claude's Discretion
- Exact file split, helper names, error message wording.
- Whether a first-run notice is needed (no).

</decisions>

<code_context>
## Existing Code Insights

- No extension code yet. `cli/` holds the Go fork (Phase 1).
  - `cli/bin/tour.exe` is built and gitignored.
  - `tour --json --count <target>` prints `{"v":1,"type":"count","files":N,"baseSha":..,"headSha":..}`.
- `scripts/headless-run.mjs` is a Node harness that keeps stdin open. Its spawn pattern can be reused in Phase 4.
- `.gitignore` has `cli/bin/`. Add `node_modules/`, `dist/`, `*.vsix`.

</code_context>

<specifics>
## Specific Ideas

- Dev machine: Windows 11, Node 25, npm 11. `code` CLI is on PATH (`code --install-extension x.vsix` can verify install). `gh` is not installed.

</specifics>

<deferred>
## Deferred Ideas

- Bundling the CLI binary inside the VSIX.
- The setup screen (v2).

</deferred>
