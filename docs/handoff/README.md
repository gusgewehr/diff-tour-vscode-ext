# Handoff: diff-tour for VS Code

## Overview
A VS Code extension that brings [diff-tour](https://github.com/init-co-jp/diff-tour) (today a terminal-only tool) into the editor. diff-tour asks an LLM CLI (Claude Code, Codex, Gemini, OpenCode, Copilot) to read a git change and write a **tour**: chapters of steps that explain what the change is for, what a reviewer would ask, where to stop and think, and which findings deserve a PR comment.

The extension lets a reviewer:
1. Set up language + LLM once.
2. Pick a change (branch, PR, commit, range, saved tour file).
3. Watch the tour being written (2–5 min) while working.
4. Walk the tour step by step in one of three layouts (Document / Inline / Focus).
5. Open any referenced code at the toured commit, **read-only**, always as a **side-by-side before/after diff**.
6. Navigate via a clickable **request-flow** diagram + a persistent flow bar.
7. Turn findings and "Example" fixes into PR review comments, take private notes, mark steps as understood.
8. **Skip the tour for small changes**: under 10 changed files, open VS Code's standard git diff instead.

Primary audiences: day-to-day PR reviewers, and people who inherited AI-written code.

## About the Design Files
The files in this bundle are **design references created in HTML**: prototypes showing intended look and behavior, not production code to copy. The task is to **build a VS Code extension in TypeScript** using the VS Code Extension API (Webview, TreeView, TextDocumentContentProvider, decorations, CodeLens, Comments, status bar, QuickPick). Use native VS Code UI wherever it exists (quick pick, tree views, diff editor, status bar, notifications) and reserve the Webview for tour content (prose, diagrams, tables).

The code shown in the prototype (`src/coupons/...`, `src/server.ts`, etc.) is **illustrative sample data**, not from a real repo.

## Fidelity
**High-fidelity** for the Webview content (tour document, flow diagram, timeline, schema, tables, snippets, question/guess cards, PR comment dialog). For parts that map to native VS Code UI (activity bar, tabs, quick pick, tree, status bar, diff editor), follow **VS Code's native look and the user's theme**; the prototype only approximates them. Webview colors should be derived from VS Code theme variables (`--vscode-*`) with the tokens below as the dark-theme reference.

## Recommended architecture

```
diff-tour-vscode/
  package.json            contributes: commands, keybindings, views, configuration, menus
  src/
    extension.ts          activate(): register everything
    cli/runner.ts         spawn diff-tour CLI, stream progress, parse tour JSON
    cli/detect.ts         detect installed LLM CLIs + sign-in status
    git/changes.ts        list branches/PRs, count changed files (git diff --name-only base...head)
    git/contentProvider.ts  scheme "difftour:" → git show <sha>:<path>  (read-only docs)
    tour/model.ts         Tour, Chapter, Step, Block types (mirror the CLI JSON)
    tour/state.ts         progress, notes, guesses, visited (workspaceState, keyed by tour id)
    tour/flow.ts          flow nodes ↔ files ↔ steps mapping
    views/outlineTree.ts  TreeDataProvider: chapters → steps (icons: done / current / question / note)
    views/filesTree.ts    TreeDataProvider: CORE / MECHANICAL / TESTS with step badges
    views/statusBar.ts
    webview/panel.ts      TourPanel (Document + Focus layouts), postMessage protocol
    webview/ui/           the tour UI (plain TS + CSS or Preact/Lit), built with esbuild
    inline/decorations.ts Inline layout: highlight ranges, end-of-line marks, step badges in gutter
    inline/codelens.ts    "Step 7/16 · prev · next · understood" above the highlighted range
    inline/ghost.ts       Example snippet as ghost/inline-preview text
    pr/comments.ts        draft → pending review comment (GitHub API or GitHub PR extension)
```

### Key APIs
- **Read-only code at a commit**: `workspace.registerTextDocumentContentProvider('difftour', …)`; URI `difftour:/<path>?sha=<sha>&side=base|head`. Content from `git show <sha>:<path>`. Never write to the working tree.
- **Side-by-side diff (everywhere code is shown)**: `vscode.commands.executeCommand('vscode.diff', baseUri, headUri, title, { selection })`. In the Webview, render the same before/after layout (see "Code block" below).
- **Small-change rule**: before starting a tour, count files with `git diff --name-only <base>...<head>`. If `< difftour.minFiles` (default **10**), do not call the LLM: open the first changed file in `vscode.diff` and reveal the SCM view / a changes list. Show an info notice (text below).
- **Progress while writing**: `window.withProgress({ location: Notification, cancellable: true })` + a Webview "Writing" view that streams the tool-call log from the CLI.
- **PR comments**: if the GitHub Pull Requests extension is installed, use its API; otherwise `@octokit/rest` with `authentication.getSession('github', ['repo'])` and create a *pending* review comment.

### Open questions for the CLI (verify in the diff-tour repo first)
1. Does the CLI emit a **stable JSON** tour and a **machine-readable progress stream** (tool calls: Read/Grep/Glob + path)? If not, add a `--json` / `--progress=jsonl` flag upstream.
2. The tour JSON needs fields that the prototype assumed:
   - per block `code: { file, at: "base"|"head", lines: [a,b], show?: [a,b], marks?: [{line,text}] }`
   - per step `question: true`, paragraph `basis: "fact"|"inferred"|"opinion"`, finding `weight: Must|Suggestion|Question|Nit|Praise`
   - `flow: { nodes: [{ id, label, kind: new|changed|same|external, file, lines, start? }] }` and per step `flowNodes: [id]`. **The flow ↔ file ↔ step mapping was invented for the prototype**; it must come from the tour JSON (or be derived: a node's steps = steps whose code blocks reference that node's file).
   - `snippet` (Example) blocks: `{ label, text }`; must never be applied automatically.

## Screens / Views

### 1. Setup (first run)
- Trigger: first `Tour a change` with no config. Implement as a Webview or a two-step QuickPick + a "What the LLM can and cannot do" Webview.
- **Language**: English / 日本語 / 简体中文 / 繁體中文 / Español (detected one tagged "detected"). Setting `difftour.language`.
- **Who writes the tour**: list of LLM CLIs with live status: `Signed in` (green dot), `Not signed in · run gemini once` (amber), `Not found · needs OpenCode 2.0 or later` (hollow dot, disabled). Tags: RECOMMENDED (Claude Code), EXPERIMENTAL (Gemini, Copilot), NEW (OpenCode 2). Setting `difftour.llm`.
- Right card, copy verbatim:
  - "SENT TO {PROVIDER}": "Tracked files at the two commits, the diff and the commit messages" / "When you ask about a step: your question and the whole tour"
  - "NOT POSSIBLE": "Reading outside the export directory, including your working tree, .git and home" / "Reading files in .gitignore, such as .env" / "Writing, editing or deleting any file" / "Running commands that change anything, or reaching the network"
  - The exact restricted command line for the selected CLI (see prototype `setupVals()`), then "Enforced by the flags passed to the tool, not only by the prompt."
- Primary: "Save and pick a change ⏎". Enter saves.

### 2. Pick a change
- Command `difftour.tourChange` (⇧⌘T). Native **QuickPick** with groups:
  - COMPARED WITH main: current branch (+uncommitted), committed only, other branches, PRs with review requested
  - SAVED: saved tours (open instantly, no LLM cost)
  - OTHER: A single commit… / A range… / A saved tour file…
- Each item's detail shows **file count and outcome**: `14 files · tour`, `3 files · opens git diff`.
- Footer text: "A new tour takes 2 to 5 minutes. A saved tour opens instantly and costs nothing."
- Also a **TOUR view container** in the activity bar (icon `route`) listing the same groups.

### 2b. Small change (< 10 files): standard diff, no tour
- Open `vscode.diff` for the first file; show changes list (SCM view or own tree "main ↔ <branch>" with M/A/D).
- Info bar / notification: "3 files changed. Changes under 10 files open in the standard diff, without a tour." + "Settings › Tour › Minimum files: 10".
- Status bar: `No tour · 3 files (under 10)`.

### 3. Writing the tour
- 4 stage cards: **1 · Export** ("git archive, git diff and git log into a cache directory. Only files git tracks."), **2 · Write** ("The LLM reads with Read, Grep and Glob, then writes the tour as JSON."), **3 · Check** ("Every file and line the tour points to must exist. Mistakes go back to the LLM, at most twice."), **4 · Show** ("Code on screen is read from git at the right commit, never copied from the reply."). States: done (green check), active (spinner, accent border), todo (dashed).
- "READING NOW" log, newest first: `time · tool · path · tag` (tags: `NOT IN DIFF`, `BASE`).
- "EXPORT DIRECTORY" card: `base/`, `head/`, `change.diff`, `commits.txt`, `lessons/`. "Deleted once the tour is written. Read, Grep and Glob only; no writes, no network."
- Buttons: Cancel, Skip to the tour (only if a previous tour exists). Notification "Your tour is ready" when done; the user may keep working meanwhile.

### 4. Tour: three layouts (toggle in title area: Document / Inline / Focus)
Shared elements:
- **Flow bar** (always visible under the title bar during a tour, every layout, also when a file is open). Height 48px. "FLOW" label (accent when the current step maps to a flow node) + three paths separated by 1px dividers: `POST coupon → handler → apply() → tables` | `POST checkout → checkout() → payment` | `reconcile`. Each node: 30px chip, 3px color bar by kind (new = green, changed = amber, same = grey, external = dashed border). **Current node**: accent border, accent 18% bg, dot with glow, never truncated (flex: 0 0 auto). Visited: muted cyan border. Tooltip: full label, "you are here", and which steps show that file's code. **Click → go to the next step that shows code of that node's file; if none (or already there) open the file itself read-only at the node's lines.**
- **Prev / Next** with step number + title; ← → keys.
- **Progress ticks** (16 bars): current = text color, 10px tall; understood = accent; visited = dim accent; unvisited = grey. Clickable.
- **Mark as understood** (U), **Note** (N, private, saved next to the tour, never in repo), **o** opens primary code, **Esc** closes file / dialog / exits focus.

**4a. Document** (default): Side bar = tour outline tree (chapters → steps, icons check_circle / play_circle / help (question) / radio, note icon). Progress "x of 16 understood". Main = Webview, max-width 880px, title (Newsreader 36px), blocks, sticky bottom nav bar 58px.

**4b. Inline**: Side bar = TOUR FILES tree (CORE / MECHANICAL / TESTS, status M/A, step badges per file, current step badge in accent). Main = real editor with the diff (base | head), highlighted range, end-of-line marks under lines, step badges in the gutter, and the **step balloon** inserted after the range (use a CodeLens + a Webview inset if available, else a hover/peek; fallback: a narrow side Webview). Balloon: "STEP n / 16", chapter, understood, note, prev/next, text + visual blocks in two columns, keyboard hints.

**4c. Focus**: Hides activity bar & side bar. Header 66px: tour title, route of chapters with ticks, "Exit focus Esc". Two columns: left 440–580px text + MY NOTE card; right "EVIDENCE" (count) with code, diagrams, tables. Footer 58px: prev, understood (U), "o open code", next. Question steps with no evidence: "Think first. The evidence comes with the answer on the next step."; text-only steps: "This step is text only. Use the flow bar above or o to open the code."

### 5. Open code (from link `src/db.ts:10`, code block ↗ icon, file tree, flow node)
- Opens read-only (`lock` icon in tab) at the toured commit, **as side-by-side diff**: left "BEFORE · main" (red tint header, `history` icon), right "AFTER · feature/coupons" (green tint, `update` icon). New files: narrow hatched left column labelled "main · this file did not exist". Unchanged files: "feature/coupons · same as main".
- Banner explains provenance, e.g. "Read-only copy of src/db.ts at feature/coupons, from the tour cache. Your working tree has a different version, so this is the code the tour talks about."
- Floating mini-player bottom-right (440px): "STEP n / 16 · opened from the tour", title, "Back to step n" (accent), "or Esc", prev/next.

### Webview blocks (see `Tour Blocks.dc.html`)
- **p**: Newsreader 17px/1.6; inline `code`, **bold**, file links (cyan underlined → open file). Optional basis tag in left gutter: Verified (green) / From the code (amber) / Senior view (violet). Paragraphs with a weight get "Draft PR comment · {weight}" button.
- **Code block (always side by side)**: header (file, dir, range, "+a −d here" / "new file" / "no change in these lines", open ↗), BEFORE | AFTER headers, rows with line numbers both sides, `−` red 18% bg on left, `+` green 16% bg on right, missing side hatched (135° stripes 5px), focused range accent 10% bg + 2px accent inset edge, marks as `└ italic note` rows under the line on the side they refer to. Alignment = line LCS diff, paired change rows.
- **timeline** (lanes × events, arrows, ok/bad/note colors), **flow** (paths of nodes, kind tag, note, "code in step" chips clickable, "open file" link when no step), **schema** (tables, + added columns, FK), **table** (findings with weight badge + "Comment"), **list** (with weight tags), **quote** (commit message), **target** (base ← head, commits with AI CO-AUTHOR tag), **files** (role groups), **snippet / EXAMPLE** (dashed amber, "Not in this repository…", Copy, Draft PR comment; never auto-applied), **question** (violet, "Stop and predict before you go on", textarea, "Show the answer"), **guess** (your guess shown on the answer step).

### PR comment dialog
- 540px modal: "Review comment · #42 …", target `file · line`, weight pills (Must, Suggestion, Question, Nit, Praise; switching rewrites the `**Lead:**` prefix), Markdown textarea prefilled from the finding (+ Example code block when from a snippet), "Saved as a pending review comment on GitHub. Your files are not touched.", buttons "Copy as Markdown", "Add to review". Status bar shows `PR #42 · n pending`.

## State Management (per tour id, `ExtensionContext.workspaceState`)
`step`, `layout`, `done{step:bool}`, `visited{}`, `notes{step:text}`, `guesses{step:text}`, `pendingComments[]`. Global settings: `difftour.language`, `difftour.llm`, `difftour.minFiles` (default 10), `difftour.defaultLayout`. Tours cached under `globalStorageUri/tours/<repo>/<base>..<head>.json`.

## Design Tokens (dark reference; map to `--vscode-*` where possible)
Colors (oklch, as used in the prototype):
- bg base `oklch(0.205 0.011 245)`, side `oklch(0.19 0.012 245)`, chrome `oklch(0.165 0.012 245)`, card `oklch(0.225 0.013 245)`, raised `oklch(0.25 0.014 245)`, code bg `oklch(0.185 0.011 245)`
- border `oklch(0.30 0.012 245)`, divider `oklch(0.255 0.012 245)`
- text `oklch(0.93 0.006 245)`, muted `oklch(0.74 0.012 245)`, faint `oklch(0.60 0.012 245)`
- accent (tour) `oklch(0.80 0.11 190)`, on-accent `oklch(0.20 0.03 200)`
- green/added `oklch(0.78 0.12 150)`, red/removed `oklch(0.74 0.13 25)`, amber/changed/Example `oklch(0.80 0.12 80)`, violet/question `oklch(0.76 0.11 300)`
- syntax: kw `oklch(0.76 0.12 300)`, str `oklch(0.80 0.11 150)`, num `oklch(0.82 0.11 70)`, type `oklch(0.82 0.09 190)`, fn `oklch(0.82 0.08 250)`, comment `oklch(0.60 0.02 245)` italic (in the editor, use the user's theme)
Typography: UI IBM Plex Sans (11–14px; labels 10.5–11px 600 letter-spacing .06–.08em uppercase); prose Newsreader (titles 32–36px/1.12 500, body 16–17px/1.55–1.6); code Fira Code 12–13px/20px. In the extension prefer `--vscode-font-family` / `--vscode-editor-font-family` for UI and code; keep a serif for tour prose (optional setting).
Radius: 4 (tags), 5–6 (rows, small buttons), 7–8 (buttons, blocks), 10–12 (cards, dialogs). Shadows: dialogs `0 24px 60px oklch(0.06 0.01 245 / .75)`, balloon `0 14px 34px oklch(0.10 0.01 245 / .55)`.
Spacing: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 28 / 40 / 56.

## Assets
- Icons: Material Symbols Outlined (Google Fonts) in the prototype. In the extension use **Codicons** equivalents (`$(git-compare)`, `$(lock)`, `$(check)`, `$(comment-discussion)`, `$(type-hierarchy)`…), and a custom `route` icon for the activity bar.
- Fonts: IBM Plex Sans, Newsreader, Fira Code (Google Fonts); bundle locally in the Webview (no network).
- No images.

## Suggested build order
1. Extension skeleton (`npm create vscode`), settings, TOUR view container, `difftour.tourChange` QuickPick with file counts.
2. **< 10 files rule** → `vscode.diff`.
3. CLI runner + Writing progress; load tour JSON; save to cache.
4. Document layout Webview + outline tree + prev/next/keys + understood/notes.
5. `difftour:` content provider; open code read-only as side-by-side diff; mini "Back to step".
6. Webview code blocks side by side; diagrams; snippet copy.
7. Flow bar + clickable flow nodes.
8. Focus layout; Inline layout (decorations, CodeLens, gutter badges).
9. PR comments (pending review) + status bar count.
10. Setup screen + LLM detection; i18n.

## Screenshots (`screenshots/`, captured from the prototype at 1440px wide)
01 setup · 02 pick a change (quick pick) · 03 writing the tour · 04 Document layout, step 1 · 05 flow diagram, step 4 · 06 side-by-side code, step 5 · 07 Inline layout, step 7 · 08 Focus layout, step 7 · 09 open file read-only diff · 10 Example snippet, step 11 · 11 PR comment dialog · 12 small change (< 10 files) in the standard diff. The prototype itself is the source of truth for behavior.

## Files
- `diff-tour IDE Prototype.dc.html` — clickable prototype (all flows, three layouts, open file, PR dialog, small-change diff). Logic in the `<script data-dc-script>` class (`renderVals`, `blocks`, `splitRows`/`align` diff alignment, `flowStrip`, `goNode`, `fixFiles`/`plainVals`).
- `Tour Blocks.dc.html` — renderer for every tour block type (markup + styles to port to the Webview).
- `diff-tour IDE.dc.html` — static canvas of explored variations (1a–1j) for reference.
- `tour-data.js`, `tour-more.js` — sample tour (16 steps, 5 chapters) and sample files; use as a fixture for the tour JSON schema.
- `support.js` — runtime needed to open the `.dc.html` files in a browser (not part of the extension).
