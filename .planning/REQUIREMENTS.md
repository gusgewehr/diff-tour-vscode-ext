# Requirements: diff-tour for VS Code

**Defined:** 2026-11-03
**Core Value:** A reviewer can walk an LLM-written tour of a git change inside VS Code, and every piece of code the tour points to opens read-only, side by side, at the exact commit the tour talks about.

## v1 Requirements

### CLI: verify and fork diff-tour

- [ ] **CLI-01**: The real upstream tour JSON schema (from `internal/tour/tour.go` and `tours/example-coupons.*.json`) is documented with a gap table against the prototype's assumptions (`tour-data.js`)
- [ ] **CLI-02**: The forked `tour` generates a tour without a TTY, writes the validated tour file, and prints a final machine-readable result (protocol version, cache key, file path, resolved base/head SHAs, cached yes/no)
- [ ] **CLI-03**: The fork emits a JSONL progress stream on stdout: stage changes (export, write, check, show), each LLM tool read (tool, path, NOT IN DIFF / BASE tag), repairs, done, error. Human text goes to stderr
- [ ] **CLI-04**: The fork accepts the LLM provider and language as flags, so no interactive setup runs
- [ ] **CLI-05**: Closing stdin or killing the fork stops generation and the LLM child process tree on Windows, leaving no orphan processes or export directories
- [ ] **CLI-06**: A headless run on Windows with Claude Code produces a valid tour of a 10+ file change, and at least 3 real tours are saved as test fixtures
- [ ] **CLI-07**: A decision is recorded, based on the sampled real tours, for the flow node → file → step mapping: derive it from code blocks, or add optional `file`/`lines` to flow nodes in the fork

### PICK: skeleton and change picker

- [ ] **PICK-01**: User can run "Tour a change" from the command palette and a keybinding that does not shadow a default VS Code binding
- [ ] **PICK-02**: The QuickPick groups changes as COMPARED WITH main (current branch, committed only, other branches), SAVED (saved tours), OTHER (a single commit…, a range…, a saved tour file…)
- [ ] **PICK-03**: Each change item shows its changed-file count and outcome (`14 files · tour` / `3 files · opens git diff`), and the footer explains cost/time ("A new tour takes 2 to 5 minutes…")
- [ ] **PICK-04**: PRs with review requested appear as a group when the `gh` CLI is available, and the group is hidden otherwise
- [ ] **PICK-05**: A TOUR view container in the activity bar lists the same groups
- [ ] **PICK-06**: User can configure `difftour.language`, `difftour.llm` (default Claude Code), `difftour.minFiles` (default 10) and the CLI path in Settings
- [ ] **PICK-07**: If the forked CLI or Claude Code is not found, user sees a notice saying what is missing and how to install it
- [ ] **PICK-08**: The extension builds into a VSIX that installs and runs on Windows

### SMALL: small-change rule

- [ ] **SMALL-01**: When the change has fewer than `difftour.minFiles` files (counted against the merge-base, the same way the CLI counts), no LLM is called and the first changed file opens in the standard `vscode.diff`
- [ ] **SMALL-02**: User sees the list of changed files (M/A/D) for that change and can open each in the standard diff
- [ ] **SMALL-03**: User sees "3 files changed. Changes under 10 files open in the standard diff, without a tour." with a link to the setting, and the status bar shows `No tour · 3 files (under 10)`

### WRITE: writing the tour

- [ ] **WRITE-01**: While a tour is written, user sees a cancellable progress notification and can keep working in the editor
- [ ] **WRITE-02**: A Writing view shows the 4 stage cards (Export, Write, Check, Show) with done / active / todo states driven by the CLI progress stream
- [ ] **WRITE-03**: The Writing view shows a READING NOW log, newest first: time · tool · path · tag
- [ ] **WRITE-04**: The Writing view shows the EXPORT DIRECTORY card explaining what the LLM can read
- [ ] **WRITE-05**: User can cancel and the CLI and its LLM child processes stop
- [ ] **WRITE-06**: When done, user gets "Your tour is ready", the tour is cached under the extension's storage, and choosing it again later (SAVED) opens instantly with no LLM call
- [ ] **WRITE-07**: CLI failures (LLM not signed in, tour still invalid after repairs, git errors) show a readable message with the next action
- [ ] **WRITE-08**: If a previous tour of the same change exists, user can "Skip to the tour" instead of waiting

### DOC: Document layout and state

- [ ] **DOC-01**: A tour opens in a Document Webview: tour title, the current step's blocks, and a sticky bottom navigation bar
- [ ] **DOC-02**: An outline tree shows chapters → steps with done / current / question / note icons and "x of N understood"; clicking a step opens it
- [ ] **DOC-03**: User can go prev/next (buttons showing step number + title, ← → keys) and jump via clickable progress ticks (current / understood / visited / unvisited)
- [ ] **DOC-04**: User can mark a step as understood (U)
- [ ] **DOC-05**: User can write a private note per step (N), stored with the extension's state and never in the repo
- [ ] **DOC-06**: Current step, understood, visited, notes and guesses persist per tour and restore after closing the panel or reloading VS Code
- [ ] **DOC-07**: The Webview follows the user's VS Code theme (dark, light, high contrast) and loads fonts and assets locally with no network
- [ ] **DOC-08**: LLM-written text is rendered safely: no script or HTML injection from tour content
- [ ] **DOC-09**: Single-letter shortcuts do not fire while the user is typing in a note or question box

### CODE: read-only code at the toured commit

- [ ] **CODE-01**: Any code reference (file link, code block open icon, `o` key) opens a read-only side-by-side `vscode.diff` of base vs head at the toured SHAs, revealed at the referenced lines
- [ ] **CODE-02**: New, deleted and unchanged files open with the missing or identical side clearly labelled
- [ ] **CODE-03**: Code is always read from git at the toured commit, never from the LLM reply, and the working tree is never written
- [ ] **CODE-04**: The diff tab title shows BEFORE · base / AFTER · head and marks it as a read-only tour copy
- [ ] **CODE-05**: From an opened file, user can go back to the step (status bar, editor title button, Esc) and go prev/next
- [ ] **CODE-06**: Opening several files while stepping does not pile up editor tabs (preview tabs reused)

### BLOCK: Webview tour blocks

- [ ] **BLOCK-01**: Paragraphs render inline code, bold and clickable file links, with the basis tag (Verified / From the code / Senior view) when present
- [ ] **BLOCK-02**: Code blocks render side by side (BEFORE | AFTER) with line-LCS alignment, line numbers on both sides, removed/added tints, a hatched missing side, the focused range highlighted, and marks under the lines they refer to
- [ ] **BLOCK-03**: Timeline, flow, schema, table, list, quote, target and files blocks render per the design references
- [ ] **BLOCK-04**: Upstream block types not in the design (`diff`, `rows`, `pre`) render, and any unknown type shows a muted fallback without breaking the step
- [ ] **BLOCK-05**: Example snippets render dashed amber with "Not in this repository…" and Copy, and are never applied to files
- [ ] **BLOCK-06**: Question steps show "Stop and predict before you go on", a textarea and "Show the answer"; the user's guess appears on the answer step
- [ ] **BLOCK-07**: A code reference whose lines don't exist at the commit is clamped and flagged as approximate instead of failing the tour

### FLOW: flow bar

- [ ] **FLOW-01**: During a tour, a flow bar of the request-flow paths stays visible, also when a diff editor is focused
- [ ] **FLOW-02**: Each node shows its kind (new / changed / same / external); the current node is highlighted and never truncated; visited nodes are muted; the tooltip shows the full label, "you are here" and which steps show its file
- [ ] **FLOW-03**: Clicking a node goes to the next step that shows code of that node's file; if none, or already there, it opens that file read-only at the node's lines
- [ ] **FLOW-04**: The FLOW label is accented when the current step maps to a flow node

## v2 Requirements

### Layouts

- **FOCUS-01**: Focus layout (hides side bars, two columns text + EVIDENCE, chapter route header)
- **INLINE-01**: Inline layout (editor decorations, end-of-line marks, gutter step badges, CodeLens, step balloon, TOUR FILES tree)

### PR comments

- **PR-01**: Draft PR comment from a finding or Example with weight pills (Must, Suggestion, Question, Nit, Praise)
- **PR-02**: Save as a pending GitHub review comment (GitHub PR extension API or Octokit); status bar `PR #n · n pending`
- **PR-03**: Copy as Markdown

### Setup and i18n

- **SETUP-01**: First-run setup screen (language, LLM with live sign-in status, "SENT TO / NOT POSSIBLE" card, restricted command line)
- **I18N-01**: Extension UI translated (English, 日本語, 简体中文, 繁體中文, Español)

### Providers and distribution

- **LLM-01**: Codex, Gemini, Copilot, OpenCode 2, Pi tested as tour writers
- **DIST-01**: Published to VS Code Marketplace / Open VSX

## Out of Scope

| Feature | Reason |
|---------|--------|
| Applying Example snippets or any edit to the working tree | Read-only by design; tours must never change the repo |
| Touring uncommitted changes | The read-only provider serves commits; v1 shows the uncommitted count as information only |
| Floating "Back to step" mini-player over native editors | Not possible with the VS Code API; replaced by status bar, title button and Esc |
| In-extension tour editor | Tours are written by the LLM; editing them is not a reviewer task |
| Custom diff renderer for opened files | Native `vscode.diff` is used everywhere outside the Webview |
| Remote assets / CDN in the Webview | Offline and CSP; fonts bundled locally |
| Calling the GitHub API in v1 | PR comments are v2; v1 detects PRs only through `gh` when present |
| Copying prototype HTML/JS | `docs/handoff/` is a design reference, not code |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| (filled by roadmap) | | |

**Coverage:**
- v1 requirements: 52 total
- Mapped to phases: 0
- Unmapped: 52 ⚠️

---
*Requirements defined: 2026-11-03*
*Last updated: 2026-11-03 after initial definition*
