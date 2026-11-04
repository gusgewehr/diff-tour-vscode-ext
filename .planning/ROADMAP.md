# Roadmap: diff-tour for VS Code

## Overview

v1 delivers the core value: a reviewer walks an LLM-written tour of a git change inside VS Code, and every code reference opens read-only, side by side, at the toured commit. Phase 1 proves and forks the CLI contract everything else consumes. Phases 2-8 follow the spec's build-order steps 1-7: picker, small-change bypass, tour writing, Document layout, read-only diffs, Webview blocks, flow bar.

## Phases

- [x] **Phase 1: Verify diff-tour CLI JSON + headless fork** - Document the real tour schema, fork the CLI for headless JSON/JSONL output, prove it on Windows with Claude Code (completed 2026-11-04)
- [x] **Phase 2: Extension skeleton + change picker** - Settings, TOUR view container, "Tour a change" QuickPick, VSIX build (completed 2026-11-04)
- [x] **Phase 3: Small-change rule** - Changes under `minFiles` open in the standard `vscode.diff` with no LLM call (completed 2026-11-04)
- [x] **Phase 4: CLI runner, Writing progress, tour cache** - Run the fork with a cancellable Writing view and cache the tour (completed 2026-11-04)
- [x] **Phase 5: Document layout, outline tree, tour state** - Webview tour document with outline, navigation, notes and persisted state
- [x] **Phase 6: difftour: read-only provider + side-by-side diff** - Every code reference opens read-only at the toured SHAs
 (completed 2026-11-04)
- [x] **Phase 7: Webview tour blocks** - Render all block types, including side-by-side code blocks with LCS alignment (completed 2026-11-04)
- [x] **Phase 8: Flow bar** - Persistent clickable request-flow strip tied to steps and files

## Phase Details

### Phase 1: Verify diff-tour CLI JSON + headless fork

**Goal**: A forked `tour` CLI produces a valid tour headlessly on Windows with a machine-readable progress stream, and the real tour schema is known.
**Depends on**: Nothing (first phase; must precede all others)
**Requirements**: CLI-01, CLI-02, CLI-03, CLI-04, CLI-05, CLI-06, CLI-07
**Research flag**: Needs deeper research/spikes (Go 1.27.2 toolchain on Windows, `claude.cmd` spawning, process-tree kill, TTY gate in `run()`)
**Success Criteria** (what must be TRUE):

  1. A schema document exists with a gap table comparing the real upstream tour JSON to the prototype's assumptions
  2. Running the forked `tour` with no TTY, with provider and language flags, writes a validated tour file and prints a final result (protocol version, key, path, resolved SHAs, cached yes/no); progress appears as JSONL on stdout and human text on stderr
  3. Closing stdin or killing the fork on Windows leaves no orphan LLM processes or export directories
  4. A headless Windows run with Claude Code produces a valid tour of a 10+ file change, and at least 3 real tours are saved as fixtures
  5. A written decision states how flow node -> file -> step is mapped (derive from code blocks, or add `file`/`lines` to flow nodes)

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Vendor upstream into cli/, build tour.exe on Windows, write docs/tour-schema.md with gap table

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Headless --json mode: JSONL progress, --llm/--lang, --count, stdin/signal cancel, taskkill tree + job object

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Windows proof: cancel tests, 3 real Claude Code tours as fixtures, flow-mapping decision

### Phase 2: Extension skeleton + change picker

**Goal**: Users can install the extension and pick a change to tour from a grouped list.
**Depends on**: Phase 1 (verified CLI contract, CLI path and change semantics; no extension work starts before Phase 1 passes)
**Requirements**: PICK-01, PICK-02, PICK-03, PICK-04, PICK-05, PICK-06, PICK-07, PICK-08
**Success Criteria** (what must be TRUE):

  1. User runs "Tour a change" from the command palette or a non-shadowing keybinding and sees COMPARED WITH main, SAVED and OTHER groups
  2. Each change item shows file count and outcome (`14 files · tour` / `3 files · opens git diff`) and the footer explains time/cost
  3. PRs with review requested appear only when `gh` is available; the TOUR activity bar view lists the same groups
  4. User can set language, LLM, `minFiles` and CLI path in Settings, and sees a clear notice if the CLI or Claude Code is missing
  5. The extension builds into a VSIX that installs and runs on Windows

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Manifest, build/test tooling, route icon, settings module, git change model with temp-repo tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 02-02-PLAN.md — CLI/Claude detection, grouped QuickPick, TOUR tree, activation and internal routing commands

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 02-03-PLAN.md — Activation smoke test, README, VSIX package + contents check, local install via code CLI

**UI hint**: yes

### Phase 3: Small-change rule

**Goal**: Small changes skip the LLM and open in VS Code's standard diff.
**Depends on**: Phase 2
**Requirements**: SMALL-01, SMALL-02, SMALL-03
**Success Criteria** (what must be TRUE):

  1. Choosing a change with fewer than `minFiles` files calls no LLM and opens the first changed file in the standard `vscode.diff`
  2. User sees the changed-file list (M/A/D) and can open each file in the standard diff
  3. User sees "3 files changed. Changes under 10 files open in the standard diff, without a tour." with a link to the setting, and the status bar shows `No tour · 3 files (under 10)`

**Plans**: 1/1 plans complete

### Phase 4: CLI runner, Writing progress, tour cache

**Goal**: Users can start a tour, watch it being written, cancel it, and reopen it instantly later.
**Depends on**: Phase 1 (progress protocol), Phase 2 (picker), Phase 3 (threshold routing)
**Requirements**: WRITE-01, WRITE-02, WRITE-03, WRITE-04, WRITE-05, WRITE-06, WRITE-07, WRITE-08
**Research flag**: Needs deeper research (Windows process-tree cancel, atomic cache write, error classification)
**Success Criteria** (what must be TRUE):

  1. While writing, user sees a cancellable progress notification and can keep editing
  2. The Writing view shows 4 stage cards (Export, Write, Check, Show) with done/active/todo states, a READING NOW log (newest first: time · tool · path · tag) and the EXPORT DIRECTORY card
  3. Cancelling stops the CLI and its LLM child processes
  4. When done, user gets "Your tour is ready"; choosing it later under SAVED opens with no LLM call, and an existing tour of the same change offers "Skip to the tour"
  5. Failures (not signed in, invalid after repairs, git errors) show a readable message with the next action

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Pure core: JSONL reducer, error mapping, runner with stdin-EOF + taskkill cancel, atomic tour cache, fake-tour fixture replay tests

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Writing Webview: shared nonce/CSP helper, WritingPanel controller, stage cards, READING NOW log, EXPORT DIRECTORY card, Cancel/Skip

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Wire startTour: notification, status bar, cache on done, "Your tour is ready", error actions, Skip; smoke, package, reinstall VSIX
**UI hint**: yes

### Phase 5: Document layout, outline tree, tour state

**Goal**: Users can walk a tour step by step in a Document Webview with progress that persists.
**Depends on**: Phase 4 (cached tour), Phase 1 (fixtures)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04, DOC-05, DOC-06, DOC-07, DOC-08, DOC-09
**Success Criteria** (what must be TRUE):

  1. A tour opens in a Webview with title, current step blocks and a sticky bottom nav; the outline tree shows chapters -> steps with done/current/question/note icons and "x of N understood"
  2. User moves with prev/next buttons, ← → keys and clickable progress ticks, marks a step understood (U) and writes a private note (N)
  3. Current step, understood, visited, notes and guesses are restored after closing the panel or reloading VS Code
  4. The Webview follows dark, light and high-contrast themes, loads fonts locally, and renders LLM text without script or HTML injection
  5. Single-letter shortcuts do nothing while typing in a note or question box

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 05-01-PLAN.md — Tour model/loader, persisted state, TourSession, message contract (vscode-free, tested)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 05-02-PLAN.md — Document Webview renderer: layout, sticky nav + ticks, note card, keys with typing guard, block registry (p + fallback), theme CSS

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 05-03-PLAN.md — Host wiring: resolveTour, TourPanel + serializer, TourController, outline tree, status bar, openCode stub, smoke, VSIX

**UI hint**: yes

### Phase 6: difftour: read-only provider + side-by-side diff

**Goal**: Every code reference in a tour opens as a read-only before/after diff at the toured commit.
**Depends on**: Phase 2 (extension skeleton); Phase 5 for the step context used by "Back to step"
**Requirements**: CODE-01, CODE-02, CODE-03, CODE-04, CODE-05, CODE-06
**Research flag**: Needs spikes (revealing a base-side line in `vscode.diff`, preview-tab reuse, read-only cue without a lock icon)
**Success Criteria** (what must be TRUE):

  1. Clicking a file link, a code block open icon, or pressing `o` opens a side-by-side diff of base vs head at the toured SHAs, revealed at the referenced lines
  2. New, deleted and unchanged files open with the missing or identical side clearly labelled
  3. The tab title shows BEFORE · base / AFTER · head and marks it as a read-only tour copy; content comes from git at the toured commit and the working tree is never written
  4. From an opened file, user can return to the step via status bar, editor title button or Esc, and go prev/next
  5. Stepping through several files reuses preview tabs instead of piling up editors

**Plans**: 2/2 plans executed
**UI hint**: yes

### Phase 7: Webview tour blocks

**Goal**: Every block type in a tour renders faithfully, with code shown side by side.
**Depends on**: Phase 5 (Webview host); Phase 6 (file links open diffs)
**Requirements**: BLOCK-01, BLOCK-02, BLOCK-03, BLOCK-04, BLOCK-05, BLOCK-06, BLOCK-07
**Success Criteria** (what must be TRUE):

  1. Paragraphs show inline code, bold, clickable file links and the basis tag (Verified / From the code / Senior view)
  2. Code blocks render BEFORE | AFTER with line-LCS alignment, line numbers, add/remove tints, hatched missing side, highlighted focus range and marks under their lines
  3. Timeline, flow, schema, table, list, quote, target and files blocks render per the design references; `diff`, `rows`, `pre` render and an unknown type shows a muted fallback without breaking the step
  4. Example snippets show dashed amber with "Not in this repository…" and Copy, and are never applied to files
  5. Question steps show "Stop and predict…", a textarea and "Show the answer", and the guess appears on the answer step; a reference to missing lines is clamped and flagged approximate

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 07-01-PLAN.md — Host enrichment: hunk alignment (align.ts), flow node->step mapping (flow.ts), StepEnricher (git), copy intent, previousGuess, async render

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 07-02-PLAN.md — Webview code/diff side-by-side renderer, target and files blocks, fallback

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 07-03-PLAN.md — quote/list/pre/table/rows/schema, timeline/flow, snippet Copy, question/guess cards; package + reinstall VSIX
**UI hint**: yes

### Phase 8: Flow bar

**Goal**: A persistent clickable request-flow strip keeps users oriented while stepping through code.
**Depends on**: Phase 5 (tour session/steps), Phase 6 (read-only file open), Phase 1 decision CLI-07 (flow data source)
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Research flag**: Needs spike (bottom-panel WebviewView vs 48px spec strip; flow data quality on real tours)
**Success Criteria** (what must be TRUE):

  1. The flow bar stays visible during a tour, including when a diff editor is focused
  2. Each node shows its kind (new/changed/same/external); the current node is highlighted and never truncated, visited nodes are muted, and the tooltip shows full label, "you are here" and the steps showing its file
  3. Clicking a node jumps to the next step showing that node's file; if none, or already there, it opens the file read-only at the node's lines
  4. The FLOW label is accented when the current step maps to a flow node

**Plans**: 1/1 plans complete
**UI hint**: yes

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Verify diff-tour CLI JSON + headless fork | 3/3 | Complete    | 2026-11-04 |
| 2. Extension skeleton + change picker | 3/3 | Complete    | 2026-11-04 |
| 3. Small-change rule | 1/1 | Complete    | 2026-11-04 |
| 4. CLI runner, Writing progress, tour cache | 3/3 | Complete    | 2026-11-04 |
| 5. Document layout, outline tree, tour state | 3/3 | Complete    | 2026-11-04 |
| 6. difftour: read-only provider + side-by-side diff | 2/2 | Complete    | 2026-11-04 |
| 7. Webview tour blocks | 3/3 | Complete    | 2026-11-04 |
| 8. Flow bar | 1/1 | Complete | 2026-11-04 |
