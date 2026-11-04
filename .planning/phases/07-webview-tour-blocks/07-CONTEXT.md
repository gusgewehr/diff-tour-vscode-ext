# Phase 7: Webview tour blocks - Context

**Gathered:** 2026-11-04
**Status:** Ready for planning
**Mode:** Autonomous. Claude made these decisions under the user's instruction: speed over polish, never ask the user.

<domain>
## Phase Boundary

Every block kind in a step renders in the Document Webview. Each renderer registers into the Phase 5 registry (`src/webview/tour/blocks/`).

Code is always rendered side by side. Its text comes from git at the toured SHAs, fetched on the host and never taken from the LLM reply.

</domain>

<decisions>
## Implementation Decisions

### Host-side enrichment (`src/tour/enrich.ts`)
- The webview cannot run git. On each `render`, the host enriches the current step's blocks and sends ready-to-draw data. Results are cached per step index for the session.
  - **code / diff:** the aligned row model (below).
  - **target:** `git log --format=%h%x00%s%x00%b%x00 baseSha..headSha`. A commit gets an "AI CO-AUTHOR" tag when its body has a `Co-authored-by:` trailer mentioning claude, copilot, codex, gemini, cursor or "ai".
  - **files:** `git diff --numstat -z baseSha headSha`, giving +/− per file, grouped by role.
  - **flow:** for each node, the steps that show its file. Use `node.file` when present (the Phase 1 fork adds it). Otherwise match the label against code-block files by basename.
- Git calls reuse `src/git/changes.ts` execFile helpers and the Phase 6 content provider module (`git show <sha>:<path>`).

### Side-by-side alignment (BLOCK-02)
- Use git's own diff, with no LCS library. Parse `git diff -U0 --no-color baseSha headSha -- <file>` hunks in `src/tour/align.ts`, a pure tested function.
- Map the shown range on the `at` side to the other side through the hunks. Then build rows over both slices.
  - Unchanged lines are paired 1:1.
  - In a hunk, removed and added lines are paired row by row as change rows. Extra lines leave the other side empty, drawn hatched.
- Each row has this shape: `{ left?: {n, text, kind: 'same'|'del'}, right?: {n, text, kind: 'same'|'add'}, focus: bool, marks: [{side, text}] }`.
- `focus` covers `lines`. The shown window is `show`, or `lines ± 2`, clamped to the file.
- Marks are rows placed under their line on the `at` side, drawn as `└ italic note`.
- New file: the left column is narrow and hatched, labelled "<base> · this file did not exist". Unchanged file or range: both sides are shown, with the header note "no change in these lines".
- Header: file name, dir (muted), range "L a–b", "+a −d here" counted in the shown window, "new file" when relevant, and an open ↗ button that posts `openCode{block index}` (Phase 6).
- Column headers: "BEFORE · <base>" (red-tinted, `$(history)` codicon or the text glyph) and "AFTER · <head>" (green-tinted).
- **BLOCK-07:** clamp `lines` and `show` to the file length. If the clamp changed anything, or the file is missing at that SHA, show an "approximate" badge. A missing file shows "<file> not found at <ref>" instead of rows. Never throw.
- No syntax highlighting. Use the monochrome editor font (`--vscode-editor-font-family`, `--vscode-editor-font-size`).

### Other blocks (BLOCK-03/04/05/06)
- **p:** already done in Phase 5. Keep the basis tags.
- **quote:** commit-message style, left border.
- **list:** bullets with inline markup.
- **pre:** monospace box.
- **table:** head and rows with inline markup. The "Comment" button is v2 and is skipped.
- **rows:** data table with a tag badge ("example" = made-up data) and highlighted added columns.
- **schema:** each table name listed with its columns. `focus` columns and new columns are highlighted, with a note "migrations: <dir>". Full migration parsing is skipped for speed. When nothing richer is available, show the table names and focus list.
- **timeline:** a CSS grid with lanes as columns. Each event is a row with an arrow from the `lane` column to the `to` column, the event text, and a mark color. `ok` is green, `bad` red, `note` amber.
- **flow:** split into paths at `start:true`. Each node is a box with:
  - a 3px kind bar: new = green, changed = amber, same = grey, external = dashed border
  - the label, the note, and the `next` arrow label
  - "code in step N" chips that post `goto{index}`
  - an "open file" link when no step shows the file and `node.file` exists, posting `openFile{file,line,at:'head'}`
- **files:** groups CORE / MECHANICAL / TESTS / CONFIG / DOCS. Each row has the file, `+a −d`, the note, and a click that posts `openFile`.
- **target:** "<base> ← <head>" with the commit list (short sha, subject, AI CO-AUTHOR tag).
- **snippet (BLOCK-05):** dashed amber border, the label (which must say "Not in this repository…"), a `lang` badge, monospace text, and a Copy button. Copy posts `{type:'copy', text}` and the host calls `vscode.env.clipboard.writeText`. The snippet is never applied to any file.
- **question (BLOCK-06):** on a `step.question` step, render a violet card at the top saying "Stop and predict before you go on", with a textarea bound to the guess (Phase 5 `guess` intent) and a "Show the answer" button that posts `next`.
  - The answer step is the step after a question step. It shows a "Your guess" card with the saved guess (the host passes `previousGuess`).
- **unknown kind:** a muted fallback box. It already exists from Phase 5, so keep it.

### Colors (theme variables only)
| Use | Variable |
|---|---|
| added | `--vscode-diffEditor-insertedLineBackground` |
| removed | `--vscode-diffEditor-removedLineBackground` |
| hatch | `repeating-linear-gradient(135deg, …)` using `--vscode-editorWidget-border` |
| focus | `--vscode-editor-selectionBackground`, plus a 2px `--vscode-focusBorder` inset edge |
| amber | `--vscode-editorWarning-foreground` |
| violet | `--vscode-charts-purple` |
| green | `--vscode-charts-green` |
| red | `--vscode-charts-red` |
| grey | `--vscode-descriptionForeground` |

### Safety
- Same as Phase 5: build every element with `textContent`, never `innerHTML` with tour or git text.

### Tests (`node --test`)
- hunk parsing
- range mapping and row alignment, including new-file, deleted, unchanged and clamp cases
- flow path split and node→step mapping on `fixtures/tours/real-9c18e24.json`
- files grouping
- trailer detection
- the snippet copy message validator
- Rebuild, run smoke, package and reinstall the VSIX.

### Claude's Discretion
- File split per block kind, CSS details.

</decisions>

<code_context>
## Existing Code Insights

- Phase 5 provides the registry `src/webview/tour/blocks/index.ts` (`register`, `renderBlock`), the inline markup tokenizer, the message validator, and `TourSession` with meta SHAs.
- Phase 6 provides the shared content provider module and `openCode`.
- Read the Phase 5 and Phase 6 SUMMARY files for exact names.

</code_context>

<specifics>
## Specific Ideas

- Design references:
  - `docs/handoff/Tour Blocks.dc.html` (markup and styles to port)
  - screenshots 05 (flow), 06 (side-by-side code) and 10 (Example snippet)
  - README section "Webview blocks"

</specifics>

<deferred>
## Deferred Ideas

- Draft PR comment buttons on findings and snippets (v2).
- Syntax highlighting.

</deferred>
