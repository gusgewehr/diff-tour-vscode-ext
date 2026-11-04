# Phase 4: CLI runner, Writing progress, tour cache - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions per user instruction (speed over polish, never ask the user).

<domain>
## Phase Boundary

Replace the `difftour.internal.startTour(target)` stub. This phase covers:
- spawning the forked CLI headlessly
- streaming its JSONL progress into a cancellable notification and a Writing Webview
- caching the finished tour in extension storage
- notifying "Your tour is ready", with routing to `difftour.internal.openSavedTour(key)`. That command is still a stub; Phase 5 implements it.

</domain>

<decisions>
## Implementation Decisions

### CLI contract (from Phase 1, `cli/FORK.md` "Headless protocol v1")
- Command line: `tour --json --llm <llm> --lang <lang> --repo <workspaceRoot> <base>..<head>`.
  - **Stdin:** keep it open for the whole run. Closing it means cancel.
  - **Stdout:** JSONL. Each line has `v:1` and a `type`, one of:
    - `stage {stage: export|write|check|show, state: active|done}`
    - `read {tool, path, tag: ""|NOT_IN_DIFF|BASE}`
    - `repair {attempt}`
    - `done {key, path, base, head, baseSha, headSha, files, cached}`
    - `error {code: usage|git|not_signed_in|cancelled|invalid_tour|llm, message, problems?}`. The process then exits with code 1.
  - **Stderr:** human-readable text. Keep the last ~50 lines for error details.
- LLM setting map: `difftour.llm` value `claude` → CLI `claude-code`. The other values pass through unchanged.
- Target: use the ref names (`<base>..<head>`) for branches, so the tour labels read well. Use SHAs for commits, ranges and PRs. Before spawning, re-check that the CLI exists (Phase 2 `detect.ts`) and show the PICK-07 notice if it does not.

### Runner (`src/cli/runner.ts`)
- Spawn with `child_process.spawn(cliPath, args, { cwd, shell: false, windowsHide: true })` and `stdio: ['pipe','pipe','pipe']`.
- Line buffer: split stdout on `\r?\n` and keep the partial tail. Ignore non-JSON lines, but log them to an OutputChannel "diff-tour".
- Cancel: `stdin.end()` first. If the process is still alive after 3 s, run `taskkill /T /F /PID <pid>` on Windows or `kill -TERM` elsewhere. Cancelling is silent (no error toast).
- The runner is injectable for tests. It takes a `{ command, args }` spawn spec, so tests can run `node fixtures-replay.mjs <file.jsonl>`.
  - Add `scripts/fake-tour.mjs`. It replays a `fixtures/tours/*.progress.jsonl` with small delays, then emits `done` pointing at the matching fixture JSON.
  - It honours stdin EOF by emitting `error cancelled`.
- Pure reducer `src/cli/progress.ts`: `(state, event) => state`. State holds:
  - `stages{export,write,check,show: todo|active|done}`
  - `reads[]`, newest first, capped at 200, each `{time, tool, path, tag}`
  - `repairs`
  - `result?`
  - `error?`
  - Unit-test it by replaying a real fixture progress file.

### Progress UI
- `window.withProgress({ location: Notification, title: "Writing tour: <label>", cancellable: true })`. The message is the current stage name plus the last read path. Cancel calls the runner's cancel.
- Status bar while writing: `$(sync~spin) Writing tour…`. Clicking it reveals the Writing view. Hide the Phase 3 small-change status item.
- The user can keep working because everything is non-blocking.

### Writing Webview (`src/webview/writing.ts` + `src/webview/writing/main.ts`)
- **Webview UI tech for the whole project:** plain TypeScript DOM, no framework. esbuild bundles it to `dist/webview/<name>.js` (browser, iife), and `npm run build` builds both entries. Each panel uses a CSP with a nonce, `localResourceRoots` set to `dist/webview` and `media`, and colors from `--vscode-*` variables only. Phases 5 and 7 follow the same pattern. Add a shared `src/webview/html.ts` helper (nonce + CSP + script/style tags) that Phase 5 reuses.
- **Panel:** `WebviewPanel` titled "Writing tour", opened beside the current editor (`ViewColumn.Active`, `preserveFocus: true`). The host posts reducer state on each event, throttled to about 100 ms.
- **Content, with copy taken from the spec:**
  - **4 stage cards.** Each card shows done (✓ green), active (spinner, accent border) or todo (dashed border). The card texts are:
    - **1 · Export:** "git archive, git diff and git log into a cache directory. Only files git tracks."
    - **2 · Write:** "The LLM reads with Read, Grep and Glob, then writes the tour as JSON."
    - **3 · Check:** "Every file and line the tour points to must exist. Mistakes go back to the LLM, at most twice."
    - **4 · Show:** "Code on screen is read from git at the right commit, never copied from the reply."
  - **"READING NOW" log.** Newest first, each row `time · tool · path · tag`. `NOT_IN_DIFF` displays as "NOT IN DIFF" and `BASE` as "BASE".
  - **"EXPORT DIRECTORY" card.** It lists `base/`, `head/`, `change.diff`, `commits.txt` and `lessons/`, with the note "Deleted once the tour is written. Read, Grep and Glob only; no writes, no network."
  - **Buttons:** Cancel, and "Skip to the tour" (WRITE-08).
- **Skip to the tour:** shown only when the cache has a saved tour with the same `label`, or with the same `baseSha` and `headSha` (an older tour of the same branch). Clicking it cancels the run and opens that saved tour via `difftour.internal.openSavedTour(key)`.

### Cache (WRITE-06)
- **Location:** `context.globalStorageUri/tours/<key>.json` (a copy of the CLI's tour file from `done.path`) plus `<key>.meta.json`.
- **Meta fields:** `{ key, label, base, head, baseSha, headSha, files, lang, llm, createdAt }`. Phase 2's SAVED group reads `label` and `files`.
- **Writes are atomic:** write `.tmp`, then rename. Create the dir if it is missing. If `done.cached` is true, still copy it when it is missing locally.
- **On done:**
  - Close the Writing panel.
  - Show `showInformationMessage("Your tour is ready", "Open tour")` → `difftour.internal.openSavedTour(key)`.
  - If the user still had the Writing panel focused, open the tour directly.
  - Refresh the changes tree and the SAVED group.

### Errors (WRITE-07)
- `not_signed_in` → "Claude Code is not signed in. Run `claude` once in a terminal, then try again." Buttons: "Open Terminal" (creates a terminal and sends `claude`), "Try again".
- `invalid_tour` → "The tour still had problems after 2 repairs." Buttons: "Try again", "Show details" (OutputChannel with the problems and stderr tail).
- `git` → "git failed: <message>". Button: "Show details".
- `llm` → "The LLM run failed: <message>". Buttons: "Try again", "Show details".
- `usage` → "diff-tour CLI rejected the arguments: <message>". Button: "Open Settings".
- `cancelled` → nothing.
- A non-zero exit with no error event → generic message plus "Show details".
- Keep the mapping pure (`code → {text, actions}`) and unit-tested.

### Verification without spending credits
- Integration-test the runner, reducer and cache with `scripts/fake-tour.mjs` replaying the real fixtures. Do not generate new real tours in this phase.
- One optional real run is allowed if cheap: a re-run of an already-cached target returns `cached:true` in under 1 s with no LLM call. The cached targets are in `fixtures/tours/README.md`, inside the scratchpad clone of diff-tour.

### Claude's Discretion
- File split, CSS details and spinner style.

</decisions>

<code_context>
## Existing Code Insights

- Phase 2 and 3 code:
  - `src/git/changes.ts` exports the target type `{label, base, head, baseSha, headSha, files, kind}`.
  - `src/cli/detect.ts` resolves the CLI path and Claude.
  - `src/settings.ts` provides the settings.
  - `src/extension.ts` registers the internal command stubs.
  - The SAVED group reads `*.meta.json`.
  - `src/small/smallChange.ts` exposes `hide()`.
  - Tests use `node --test`. `scripts/smoke-activate.mjs` uses a fake vscode.
- `scripts/headless-run.mjs` (Phase 1) shows a working Node spawn of `tour.exe` with stdin held open. Reuse its approach.
- Fixtures:
  - `fixtures/tours/real-{b146230,9cbe3d2,9c18e24}.json` + `.progress.jsonl`
  - `example-coupons.en.json`

</code_context>

<specifics>
## Specific Ideas

- Real runs take 6.5–8 min and cost about $2. Don't trigger them in tests.

</specifics>

<deferred>
## Deferred Ideas

- The "Ask about a step" LLM follow-up (not in v1).

</deferred>
